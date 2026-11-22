import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';
import { getPageParams } from '../utils/pagination.js';
import { ShipmentModel } from '../models/Shipment.js';
import { ProcessedWebhookModel } from '../models/ProcessedWebhook.js';
import { OrderModel } from '../models/Order.js';
import {
  applyCarrierWebhook,
  cancelShipmentForOrder,
  carrierStatus,
  checkServiceability,
  createShipmentForOrder,
  fetchDelhiveryLabel,
  findShipmentForWebhook,
  getShippingSettings,
  quoteForOrder,
  serializeShipment,
  shipmentSummary,
  syncShipment,
  syncShipmentById,
  updateShippingSettings,
} from '../services/shipping/index.js';
import { COURIER_LIST, SHIPMENT_STATUS_LABELS, type ShippingSettings } from '@shared/shipping.js';

/* ------------------------------------------------------------------------- */
/* Public storefront                                                          */
/* ------------------------------------------------------------------------- */

/** GET /api/shipping/config — public delivery policy + carrier availability. */
export async function getShippingConfig(_req: Request, res: Response) {
  const settings = await getShippingSettings();
  res.json({
    success: true,
    data: {
      settings: publicSettings(settings),
      carriers: carrierStatus(),
      couriers: COURIER_LIST.map((c) => ({
        code: c.code,
        name: c.name,
        mode: c.mode,
        supportsCod: c.supportsCod,
        supportsPickup: c.supportsPickup,
      })),
    },
  });
}

/**
 * GET /api/shipping/serviceability?pincode=&itemsTotal=&weight=&cod=
 * Public. Live rates when a carrier is configured, otherwise a documented
 * zone-based estimate so checkout never blocks on an unavailable API.
 */
export async function getServiceability(req: Request, res: Response) {
  const result = await checkServiceability({
    pincode: String(req.query.pincode ?? ''),
    itemsTotal: Number(req.query.itemsTotal ?? 0),
    weightKg: Number(req.query.weight ?? 0),
    cod: String(req.query.cod ?? 'true') !== 'false',
  });
  res.set('Cache-Control', 'no-store');
  res.json({ success: true, data: result });
}

/** GET /api/shipping/status/:orderId — customer polling helper (auth checked by caller). */
export async function getOrderShipment(req: Request, res: Response) {
  const order = await OrderModel.findById(req.params.orderId).select('user shipment');
  if (!order) throw new ApiError(404, 'Order not found.');
  if (String(order.user) !== String(req.user!._id) && req.user!.role !== 'ADMIN') {
    throw new ApiError(403, 'Not allowed.');
  }
  if (!order.shipment) return res.json({ success: true, data: null });
  const shipment = await ShipmentModel.findById(order.shipment);
  res.json({ success: true, data: shipment ? shipmentSummary(shipment) : null });
}

/* ------------------------------------------------------------------------- */
/* Admin — settings                                                           */
/* ------------------------------------------------------------------------- */

/** GET /api/shipping/admin/settings */
export async function getSettings(_req: Request, res: Response) {
  const settings = await getShippingSettings();
  res.json({
    success: true,
    data: { settings, carriers: carrierStatus(), couriers: COURIER_LIST },
  });
}

/** PUT /api/shipping/admin/settings */
export async function putSettings(req: Request, res: Response) {
  const settings = await updateShippingSettings(req.body ?? {}, String(req.user!._id));
  res.json({ success: true, data: settings, message: 'Shipping settings saved.' });
}

/* ------------------------------------------------------------------------- */
/* Admin — shipments                                                          */
/* ------------------------------------------------------------------------- */

/** GET /api/shipping/admin/shipments?status=&page=&limit= */
export async function listShipments(req: Request, res: Response) {
  const { page, limit, skip } = getPageParams(req, 20, 100);
  const filter: Record<string, unknown> = {};
  const status = String(req.query.status ?? '').toUpperCase();
  if (status && status in SHIPMENT_STATUS_LABELS) filter.status = status;

  const [rows, total, counts] = await Promise.all([
    ShipmentModel.find(filter)
      .populate('order', 'total status paymentMethod paymentStatus shippingAddress createdAt')
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ShipmentModel.countDocuments(filter),
    ShipmentModel.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  const countMap: Record<string, number> = {};
  for (const row of counts) countMap[row._id] = row.count;

  res.json({
    success: true,
    data: {
      shipments: rows.map((row) => serializeShipment(row)),
      counts: countMap,
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
}

/** GET /api/shipping/admin/orders/:orderId/quote — live courier options for an order. */
export async function quoteOrder(req: Request, res: Response) {
  const result = await quoteForOrder(req.params.orderId);
  res.json({ success: true, data: result });
}

/** POST /api/shipping/admin/orders/:orderId/shipment — create + AWB + label + pickup. */
export async function createShipment(req: Request, res: Response) {
  const order = await OrderModel.findById(req.params.orderId).select('paymentMethod paymentStatus status');
  if (!order) throw new ApiError(404, 'Order not found.');
  if (order.paymentMethod === 'RAZORPAY' && order.paymentStatus !== 'PAID') {
    throw new ApiError(400, 'Cannot ship an unpaid online order. Collect payment first.');
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const shipment = await createShipmentForOrder(
    req.params.orderId,
    {
      courierCode: body.courierCode ? (String(body.courierCode).toUpperCase() as any) : undefined,
      weight: numberOrUndefined(body.weight),
      length: numberOrUndefined(body.length),
      breadth: numberOrUndefined(body.breadth),
      height: numberOrUndefined(body.height),
      pickupDate: body.pickupDate ? String(body.pickupDate) : undefined,
      schedulePickup: body.schedulePickup !== false,
    },
    String(req.user!._id)
  );

  res.status(201).json({
    success: true,
    data: shipment,
    message: shipment.awb
      ? `Shipment created with ${shipment.courierName} · AWB ${shipment.awb}.`
      : 'Shipment created. AWB assignment is pending.',
  });
}

/** GET /api/shipping/admin/shipments/:id */
export async function getShipment(req: Request, res: Response) {
  const shipment = await ShipmentModel.findById(req.params.id).populate('order', 'total status shippingAddress');
  if (!shipment) throw new ApiError(404, 'Shipment not found.');
  res.json({ success: true, data: serializeShipment(shipment) });
}

/** POST /api/shipping/admin/shipments/:id/sync — pull the latest carrier scans. */
export async function syncShipmentHandler(req: Request, res: Response) {
  const shipment = await syncShipmentById(req.params.id);
  res.json({ success: true, data: shipment, message: 'Tracking refreshed.' });
}

/** POST /api/shipping/admin/shipments/:id/pickup */
export async function schedulePickup(req: Request, res: Response) {
  const shipment = await ShipmentModel.findById(req.params.id);
  if (!shipment) throw new ApiError(404, 'Shipment not found.');
  const provider = shipment.provider === 'DELHIVERY'
    ? (await import('../services/shipping/delhivery.js')).delhiveryProvider
    : (await import('../services/shipping/shiprocket.js')).shiprocketProvider;
  if (!provider.isConfigured()) throw new ApiError(503, 'This carrier is not configured.');
  const date = req.body?.pickupDate ? new Date(String(req.body.pickupDate)) : undefined;
  if (date && Number.isNaN(date.getTime())) throw new ApiError(400, 'Invalid pickup date.');
  const result = await provider.schedulePickup(
    {
      providerOrderId: shipment.providerOrderId,
      providerShipmentId: shipment.providerShipmentId,
      awb: shipment.awb,
    },
    date
  );
  shipment.pickupScheduledAt = result.scheduledAt;
  if (shipment.status === 'PENDING' || shipment.status === 'CREATED') {
    shipment.status = 'PICKUP_SCHEDULED';
    shipment.events.unshift({
      status: 'PICKUP_SCHEDULED',
      rawStatus: 'Pickup scheduled',
      at: new Date(),
      note: `Pickup requested for ${result.scheduledAt.toDateString()}`,
    });
  }
  await shipment.save();
  res.json({ success: true, data: serializeShipment(shipment), message: 'Pickup scheduled.' });
}

/** POST /api/shipping/admin/shipments/:id/cancel */
export async function cancelShipment(req: Request, res: Response) {
  const shipment = await ShipmentModel.findById(req.params.id);
  if (!shipment) throw new ApiError(404, 'Shipment not found.');
  await cancelShipmentForOrder(String(shipment.order));
  const updated = await ShipmentModel.findById(req.params.id);
  res.json({ success: true, data: updated ? serializeShipment(updated) : null, message: 'Shipment cancelled.' });
}

/** GET /api/shipping/admin/shipments/:id/label — authenticated label proxy. */
export async function downloadLabel(req: Request, res: Response) {
  const shipment = await ShipmentModel.findById(req.params.id);
  if (!shipment) throw new ApiError(404, 'Shipment not found.');

  if (shipment.provider === 'DELHIVERY' && shipment.awb) {
    const upstream = await fetchDelhiveryLabel(shipment.awb);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="label-${shipment.awb}.pdf"`);
    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.send(buffer);
    return;
  }

  if (shipment.labelUrl) {
    res.redirect(shipment.labelUrl);
    return;
  }
  throw new ApiError(404, 'The carrier has not generated a label yet. Refresh tracking or retry later.');
}

function numberOrUndefined(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/* ------------------------------------------------------------------------- */
/* Webhooks                                                                   */
/* ------------------------------------------------------------------------- */

function verifyToken(req: Request, expected: string): boolean {
  if (!expected) return false;
  const provided =
    String(req.headers['x-webhook-token'] ?? '') ||
    String(req.headers['x-api-key'] ?? '') ||
    String(req.query.token ?? '');
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function claimEvent(provider: string, eventId: string, eventType: string): Promise<boolean> {
  try {
    await ProcessedWebhookModel.create({ provider, eventId, eventType });
    return true;
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return false;
    throw error;
  }
}

/** POST /api/shipping/webhook/shiprocket */
export async function shiprocketWebhook(req: Request, res: Response) {
  if (!env.shiprocketWebhookToken) {
    return res.status(503).json({ success: false, message: 'Shiprocket webhook token is not configured.' });
  }
  if (!verifyToken(req, env.shiprocketWebhookToken)) {
    return res.status(401).json({ success: false, message: 'Invalid webhook token.' });
  }

  const body = (req.body ?? {}) as Record<string, any>;
  const awb = String(body.awb ?? body.awb_code ?? '');
  const status = String(
    body.current_status ?? body.shipment_status ?? body.status ?? body.current_status_id ?? ''
  );
  const scans: Array<Record<string, any>> = Array.isArray(body.scans) ? body.scans : [];
  const latestScan = scans[scans.length - 1] ?? {};
  const rawStatus = String(latestScan.activity ?? latestScan.status ?? status ?? 'Update');
  const at = new Date(latestScan.date ?? body.current_timestamp ?? body.updated_at ?? Date.now());

  const eventId = String(
    body.event_id ?? body.id ?? crypto.createHash('sha256')
      .update(JSON.stringify({ awb, rawStatus, at: at.toISOString() }))
      .digest('hex')
  );
  if (!(await claimEvent('SHIPROCKET', eventId, 'shipment_update'))) {
    return res.json({ success: true, message: 'Event already processed.' });
  }

  const shipment = await findShipmentForWebhook({
    awb,
    providerOrderId: body.order_id ? String(body.order_id) : undefined,
    providerShipmentId: body.shipment_id ? String(body.shipment_id) : undefined,
    orderId: body.channel_order_id ? String(body.channel_order_id) : undefined,
  });
  if (!shipment) {
    console.warn('[shipping] Shiprocket webhook for unknown shipment:', { awb, orderId: body.channel_order_id });
    return res.json({ success: true, message: 'No matching shipment.' });
  }

  await applyCarrierWebhook(
    shipment,
    rawStatus || 'Update',
    at,
    latestScan.activity ?? latestScan.status ?? status,
    latestScan.location ?? body.current_location ?? ''
  );
  return res.json({ success: true, message: 'Webhook processed.' });
}

/** POST /api/shipping/webhook/delhivery */
export async function delhiveryWebhook(req: Request, res: Response) {
  if (!env.delhiveryWebhookToken) {
    return res.status(503).json({ success: false, message: 'Delhivery webhook token is not configured.' });
  }
  if (!verifyToken(req, env.delhiveryWebhookToken)) {
    return res.status(401).json({ success: false, message: 'Invalid webhook token.' });
  }

  const body = (req.body ?? {}) as Record<string, any>;
  const shipmentNode = body.Shipment ?? body.shipment ?? {};
  const awb = String(shipmentNode.AWB ?? shipmentNode.awb ?? body.awb ?? '');
  const statusNode = shipmentNode.Status ?? shipmentNode.status ?? {};
  const rawStatus = String(statusNode.Status ?? statusNode.status ?? body.status ?? 'Update');
  const at = new Date(statusNode.StatusDateTime ?? statusNode.status_date_time ?? Date.now());
  const orderId = String(shipmentNode.ReferenceNo ?? shipmentNode.reference_no ?? body.order_id ?? '');

  const eventId = String(
    body.event_id ?? body.id ?? crypto.createHash('sha256')
      .update(JSON.stringify({ awb, rawStatus, at: at.toISOString() }))
      .digest('hex')
  );
  if (!(await claimEvent('DELHIVERY', eventId, 'shipment_update'))) {
    return res.json({ success: true, message: 'Event already processed.' });
  }

  const shipment = await findShipmentForWebhook({ awb, orderId });
  if (!shipment) {
    console.warn('[shipping] Delhivery webhook for unknown shipment:', { awb, orderId });
    return res.json({ success: true, message: 'No matching shipment.' });
  }

  await applyCarrierWebhook(
    shipment,
    rawStatus || 'Update',
    at,
    statusNode.Instructions ?? rawStatus,
    statusNode.StatusLocation ?? ''
  );
  return res.json({ success: true, message: 'Webhook processed.' });
}

/** GET /api/shipping/couriers — public courier catalogue for admin/checkout. */
export function listCouriers(_req: Request, res: Response) {
  res.json({ success: true, data: COURIER_LIST });
}

function publicSettings(settings: ShippingSettings): Omit<ShippingSettings, 'contactPhone'> & { contactPhone: string } {
  return {
    ...settings,
    // The support number is intentionally public; it is already shown on the site.
    contactPhone: settings.contactPhone,
  };
}
