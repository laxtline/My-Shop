import type { ClientSession } from 'mongoose';
import {
  COURIERS,
  DEFAULT_SHIPPING_SETTINGS,
  courierCodeFromName,
  estimateDelivery,
  shipmentStatusFromText,
  shipmentWeightKg,
  type CourierCode,
  type ServiceabilityResult,
  type ShipmentEvent,
  type ShipmentStatus,
  type ShippingSettings,
} from '@shared/shipping.js';
import { env, shiprocketEnabled, delhiveryEnabled, carrierIntegrationEnabled } from '../../config/env.js';
import { ShippingSettingsModel } from '../../models/ShippingSettings.js';
import { ShipmentModel } from '../../models/Shipment.js';
import { OrderModel } from '../../models/Order.js';
import { UserModel } from '../../models/User.js';
import { ApiError } from '../../utils/ApiError.js';
import { notifyOrderStatusChange } from '../push.js';
import { shiprocketProvider } from './shiprocket.js';
import { delhiveryProvider, delhiveryLabelUrl } from './delhivery.js';
import type { ShippingOrderInput, ShippingProvider } from './provider.js';

const PROVIDERS: ShippingProvider[] = [shiprocketProvider, delhiveryProvider];

export function carrierStatus() {
  return {
    shiprocket: shiprocketEnabled,
    delhivery: delhiveryEnabled,
    any: carrierIntegrationEnabled,
  };
}

/* ------------------------------------------------------------------------- */
/* Settings                                                                   */
/* ------------------------------------------------------------------------- */

function envDefaults(): Partial<ShippingSettings> {
  return {
    originPincode: env.storePincode,
    originCity: env.storeCity,
    originState: env.storeState,
    pickupLocationName: env.shiprocketPickupLocation || env.delhiveryPickupLocation || DEFAULT_SHIPPING_SETTINGS.pickupLocationName,
  };
}

export async function getShippingSettings(): Promise<ShippingSettings> {
  const defaults = { ...DEFAULT_SHIPPING_SETTINGS, ...envDefaults() };
  try {
    const doc = await ShippingSettingsModel.findOneAndUpdate(
      { key: 'default' },
      { $setOnInsert: { key: 'default', ...defaults } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();
    if (!doc) return defaults;
    return {
      originPincode: doc.originPincode || defaults.originPincode,
      originCity: doc.originCity || defaults.originCity,
      originState: doc.originState || defaults.originState,
      pickupLocationName: doc.pickupLocationName || defaults.pickupLocationName,
      contactName: doc.contactName || defaults.contactName,
      contactPhone: doc.contactPhone || defaults.contactPhone,
      addressLine1: doc.addressLine1 || '',
      addressLine2: doc.addressLine2 || '',
      baseDeliveryFee: doc.baseDeliveryFee ?? defaults.baseDeliveryFee,
      freeDeliveryOver: doc.freeDeliveryOver ?? defaults.freeDeliveryOver,
      codEnabled: doc.codEnabled ?? defaults.codEnabled,
      codFee: doc.codFee ?? defaults.codFee,
      serviceablePincodes: doc.serviceablePincodes ?? [],
      noCodPincodes: doc.noCodPincodes ?? [],
      localDaysMin: doc.localDaysMin ?? defaults.localDaysMin,
      localDaysMax: doc.localDaysMax ?? defaults.localDaysMax,
      regionalDaysMin: doc.regionalDaysMin ?? defaults.regionalDaysMin,
      regionalDaysMax: doc.regionalDaysMax ?? defaults.regionalDaysMax,
      nationalDaysMin: doc.nationalDaysMin ?? defaults.nationalDaysMin,
      nationalDaysMax: doc.nationalDaysMax ?? defaults.nationalDaysMax,
    };
  } catch (error) {
    console.warn('[shipping] Could not load settings, using defaults:', error);
    return defaults;
  }
}

const SETTINGS_FIELDS = [
  'originPincode', 'originCity', 'originState', 'pickupLocationName', 'contactName', 'contactPhone',
  'addressLine1', 'addressLine2', 'baseDeliveryFee', 'freeDeliveryOver', 'codEnabled', 'codFee',
  'serviceablePincodes', 'noCodPincodes', 'localDaysMin', 'localDaysMax', 'regionalDaysMin',
  'regionalDaysMax', 'nationalDaysMin', 'nationalDaysMax',
] as const;

export async function updateShippingSettings(patch: Record<string, unknown>, userId?: string): Promise<ShippingSettings> {
  const update: Record<string, unknown> = {};
  for (const field of SETTINGS_FIELDS) {
    if (patch[field] === undefined) continue;
    if (field === 'serviceablePincodes' || field === 'noCodPincodes') {
      if (!Array.isArray(patch[field])) throw new ApiError(400, `${field} must be an array of pincodes.`);
      update[field] = (patch[field] as unknown[])
        .map(String)
        .map((p) => p.replace(/\D/g, ''))
        .filter((p) => /^[1-9]\d{2,5}$/.test(p))
        .slice(0, 500);
    } else if (field === 'codEnabled') {
      update[field] = Boolean(patch[field]);
    } else if (field === 'originPincode') {
      const value = String(patch[field] ?? '').trim();
      if (!/^[1-9]\d{5}$/.test(value)) throw new ApiError(400, 'Origin pincode must be 6 digits.');
      update[field] = value;
    } else if (typeof patch[field] === 'number') {
      if (!Number.isFinite(patch[field]) || (patch[field] as number) < 0) throw new ApiError(400, `${field} must be a positive number.`);
      update[field] = patch[field];
    } else {
      update[field] = String(patch[field] ?? '').slice(0, 200);
    }
  }
  update.updatedBy = userId ?? null;
  await ShippingSettingsModel.updateOne({ key: 'default' }, { $set: update }, { upsert: true });
  return getShippingSettings();
}

/* ------------------------------------------------------------------------- */
/* Serviceability                                                             */
/* ------------------------------------------------------------------------- */

function matchesPrefix(list: string[], pincode: string): boolean {
  return list.some((prefix) => pincode.startsWith(prefix));
}

function deliveryFeeFor(itemsTotal: number, settings: ShippingSettings): number {
  if (itemsTotal >= settings.freeDeliveryOver) return 0;
  return Math.max(0, settings.baseDeliveryFee);
}

export interface ServiceabilityQuery {
  pincode: string;
  itemsTotal?: number;
  weightKg?: number;
  cod?: boolean;
}

export async function checkServiceability(query: ServiceabilityQuery): Promise<ServiceabilityResult> {
  const pincode = String(query.pincode ?? '').replace(/\D/g, '');
  if (!/^[1-9]\d{5}$/.test(pincode)) throw new ApiError(400, 'Enter a valid 6-digit pincode.');

  const settings = await getShippingSettings();
  const itemsTotal = Math.max(0, Number(query.itemsTotal) || 0);
  const weightKg = Math.max(0.5, Number(query.weightKg) || 0.5);
  const wantsCod = query.cod !== false;

  const fee = deliveryFeeFor(itemsTotal, settings);
  const codAllowedByShop =
    settings.codEnabled && !matchesPrefix(settings.noCodPincodes, pincode);

  if (settings.serviceablePincodes.length && !matchesPrefix(settings.serviceablePincodes, pincode)) {
    return {
      pincode,
      serviceable: false,
      codAvailable: false,
      deliveryFee: fee,
      codFee: 0,
      freeDeliveryOver: settings.freeDeliveryOver,
      estimatedDaysMin: 0,
      estimatedDaysMax: 0,
      source: 'estimate',
      options: [],
      message: `We currently do not deliver to ${pincode}.`,
      checkedAt: new Date().toISOString(),
    };
  }

  const estimate = estimateDelivery(settings.originPincode, pincode, settings);

  let options = [] as ServiceabilityResult['options'];
  let message: string | undefined;
  let source: ServiceabilityResult['source'] = 'estimate';

  for (const provider of PROVIDERS) {
    if (!provider.isConfigured()) continue;
    try {
      const quotes = await provider.serviceability(settings.originPincode, pincode, weightKg, wantsCod);
      if (quotes.length) {
        options = quotes.slice(0, 8);
        source = 'provider';
        message = undefined;
        break;
      }
      message = `No ${provider.code === 'SHIPROCKET' ? 'courier' : 'Delhivery'} service for this pincode.`;
    } catch (error) {
      message = error instanceof Error ? error.message : 'Carrier lookup failed.';
      console.warn(`[shipping] ${provider.code} serviceability failed:`, message);
    }
  }

  // Live quotes reveal which couriers actually accept cash for this lane.
  if (source === 'provider') {
    const codOptions = options.filter((option) => option.codAvailable);
    if (wantsCod && codOptions.length === 0) {
      return {
        pincode,
        serviceable: true,
        codAvailable: false,
        deliveryFee: fee,
        codFee: 0,
        freeDeliveryOver: settings.freeDeliveryOver,
        estimatedDaysMin: Math.min(...options.map((o) => o.estimatedDaysMin)),
        estimatedDaysMax: Math.max(...options.map((o) => o.estimatedDaysMax)),
        source,
        options,
        message: 'Cash on Delivery is not available for this pincode. Please pay online.',
        checkedAt: new Date().toISOString(),
      };
    }
    options = wantsCod ? codOptions : options;
  }

  const serviceable = source === 'provider' ? options.length > 0 : true;
  const daysMin = options.length ? Math.min(...options.map((o) => o.estimatedDaysMin)) : estimate.min;
  const daysMax = options.length ? Math.max(...options.map((o) => o.estimatedDaysMax)) : estimate.max;

  return {
    pincode,
    serviceable,
    codAvailable: serviceable && codAllowedByShop && (source === 'estimate' || options.length > 0),
    deliveryFee: fee,
    codFee: codAllowedByShop ? Math.max(0, settings.codFee) : 0,
    freeDeliveryOver: settings.freeDeliveryOver,
    estimatedDaysMin: daysMin,
    estimatedDaysMax: daysMax,
    source,
    options,
    message: !serviceable ? message ?? `We currently do not deliver to ${pincode}.` : undefined,
    checkedAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------------- */
/* Shipment creation                                                          */
/* ------------------------------------------------------------------------- */

function providerFor(courierCode?: CourierCode): ShippingProvider {
  const directDelhiveryPreferred =
    courierCode === 'DELHIVERY' && delhiveryEnabled && !shiprocketEnabled;
  if (directDelhiveryPreferred) return delhiveryProvider;
  if (shiprocketEnabled) return shiprocketProvider;
  if (delhiveryEnabled) return delhiveryProvider;
  throw new ApiError(
    503,
    'No courier integration is configured. Add SHIPROCKET_EMAIL/SHIPROCKET_PASSWORD (recommended) or DELHIVERY_API_TOKEN to the backend environment.'
  );
}

function orderNumber(orderId: string): string {
  return orderId.slice(-10).toUpperCase();
}

export async function quoteForOrder(orderId: string): Promise<ServiceabilityResult> {
  const order = await OrderModel.findById(orderId);
  if (!order) throw new ApiError(404, 'Order not found.');
  return checkServiceability({
    pincode: order.shippingAddress.pincode,
    itemsTotal: order.itemsTotal,
    weightKg: shipmentWeightKg(order.items as unknown as Array<{ weight?: number; quantity: number }>),
    cod: order.paymentMethod === 'COD',
  });
}

export interface CreateShipmentOptions {
  courierCode?: CourierCode;
  weight?: number;
  length?: number;
  breadth?: number;
  height?: number;
  pickupDate?: string;
  schedulePickup?: boolean;
}

export async function createShipmentForOrder(
  orderId: string,
  options: CreateShipmentOptions = {},
  adminUserId?: string
) {
  const order = await OrderModel.findById(orderId).populate('user', 'name email');
  if (!order) throw new ApiError(404, 'Order not found.');
  if (['CANCELLED', 'DELIVERED'].includes(order.status)) {
    throw new ApiError(400, `Cannot create a shipment for a ${order.status.toLowerCase()} order.`);
  }
  if (order.status === 'SHIPPED' || order.status === 'OUT_FOR_DELIVERY') {
    throw new ApiError(400, 'This order is already with the courier.');
  }
  const existing = await ShipmentModel.findOne({ order: order._id });
  if (existing) return serializeShipment(existing);

  const user = typeof order.user === 'object' && order.user ? (order.user as any) : null;
  if (!user?.email) {
    const owner = await UserModel.findById(order.user).select('name email');
    if (owner) {
      (order as any).user = owner;
    }
  }
  const customerUser = (typeof order.user === 'object' && order.user ? order.user : null) as
    | { name?: string; email?: string }
    | null;

  const settings = await getShippingSettings();
  const provider = providerFor(options.courierCode);
  const weightKg = Math.max(0.5, Number(options.weight) || shipmentWeightKg(order.items as unknown as Array<{ weight?: number; quantity: number }>));
  const dimensions = {
    length: Math.max(1, Number(options.length) || 20),
    breadth: Math.max(1, Number(options.breadth) || 15),
    height: Math.max(1, Number(options.height) || 10),
  };

  let preferredCourierId: string | undefined;
  let preferredQuoteRate = 0;
  let preferredQuoteEta: { min: number; max: number } | undefined;
  if (options.courierCode && provider.code === 'SHIPROCKET') {
    try {
      const quotes = await provider.serviceability(
        settings.originPincode,
        order.shippingAddress.pincode,
        weightKg,
        order.paymentMethod === 'COD'
      );
      const match =
        quotes.find((q) => q.courierCode === options.courierCode) ??
        quotes.find((q) => q.courierCode === 'SHIPROCKET');
      if (match) {
        preferredCourierId = match.providerCourierId;
        preferredQuoteRate = match.rate;
        preferredQuoteEta = { min: match.estimatedDaysMin, max: match.estimatedDaysMax };
      }
    } catch (error) {
      console.warn('[shipping] Could not resolve preferred courier, using auto-assignment:', error);
    }
  }

  const input: ShippingOrderInput = {
    orderId: order.id,
    orderNumber: orderNumber(order.id),
    createdAt: order.createdAt ?? new Date(),
    paymentMethod: order.paymentMethod as 'COD' | 'RAZORPAY',
    paymentStatus: order.paymentStatus as 'PENDING' | 'PAID' | 'FAILED',
    codAmount: order.paymentMethod === 'COD' ? order.total : 0,
    itemsTotal: order.itemsTotal,
    total: order.total,
    items: order.items.map((item) => ({
      title: item.title,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
    customer: {
      name: order.shippingAddress.fullName,
      phone: order.shippingAddress.phone,
      email: customerUser?.email ?? '',
      addressLine1: order.shippingAddress.line1,
      addressLine2: order.shippingAddress.line2 ?? '',
      city: order.shippingAddress.city,
      state: order.shippingAddress.state,
      pincode: order.shippingAddress.pincode,
    },
    weightKg,
    dimensions,
    preferredCourierId,
    preferredCourierName: options.courierCode ? COURIERS[options.courierCode].name : undefined,
  };

  const created = await provider.createShipment(input, settings.pickupLocationName);
  const courierCode = courierCodeFromName(created.courierName) ?? options.courierCode ?? null;
  const trackingUrl =
    created.trackingUrl || (courierCode ? COURIERS[courierCode].trackingUrl(created.awb) : '');
  const fallbackEta = estimateDelivery(settings.originPincode, order.shippingAddress.pincode, settings);
  const etaDays = preferredQuoteEta ?? { min: fallbackEta.min, max: fallbackEta.max };
  const estimatedDeliveryDate = new Date(Date.now() + etaDays.max * 24 * 60 * 60 * 1000);

  const now = new Date();
  let shipment;
  try {
    shipment = await ShipmentModel.create({
      order: order._id,
      provider: provider.code,
      providerOrderId: created.providerOrderId,
      providerShipmentId: created.providerShipmentId,
      status: created.awb ? 'CREATED' : 'PENDING',
      courierCode,
      courierName: created.courierName || (courierCode ? COURIERS[courierCode].name : ''),
      awb: created.awb,
      trackingUrl,
      labelUrl: created.labelUrl,
      weight: weightKg,
      ...dimensions,
      codAmount: order.paymentMethod === 'COD' ? order.total : 0,
      charge: created.charge || preferredQuoteRate,
      estimatedDeliveryDate,
      events: [
        {
          status: 'CREATED',
          rawStatus: 'Shipment created',
          at: now,
          note: `Shipment created with ${created.courierName || provider.code}`,
        },
      ],
      warnings: created.warnings,
      payload: created.payload,
      createdBy: adminUserId ?? null,
    });
  } catch (error) {
    // A concurrent admin request won the unique order index — return that one.
    if ((error as { code?: number }).code === 11000) {
      const raced = await ShipmentModel.findOne({ order: order._id });
      if (raced) return serializeShipment(raced);
    }
    throw error;
  }

  // Move the order to PACKED and attach the carrier details.
  if (order.status === 'CONFIRMED') {
    order.status = 'PACKED';
  }
  order.shipment = shipment._id;
  order.expectedDeliveryDate = estimatedDeliveryDate;
  order.courierInfo = {
    name: shipment.courierName,
    trackingId: shipment.awb,
    trackingUrl: shipment.trackingUrl,
  };
  order.statusHistory.push({
    status: order.status,
    timestamp: now,
    note: `Shipment created: ${shipment.courierName || provider.code}${shipment.awb ? ` · AWB ${shipment.awb}` : ''}`,
  });
  await order.save();

  if (options.schedulePickup !== false) {
    try {
      const pickupDate = options.pickupDate ? new Date(options.pickupDate) : undefined;
      if (pickupDate && Number.isNaN(pickupDate.getTime())) throw new Error('Invalid pickup date.');
      const pickup = await provider.schedulePickup(
        {
          providerOrderId: shipment.providerOrderId,
          providerShipmentId: shipment.providerShipmentId,
          awb: shipment.awb,
        },
        pickupDate
      );
      shipment.pickupScheduledAt = pickup.scheduledAt;
      shipment.status = shipment.status === 'PENDING' ? 'PICKUP_SCHEDULED' : shipment.status;
      shipment.events.push({
        status: 'PICKUP_SCHEDULED',
        rawStatus: 'Pickup scheduled',
        at: new Date(),
        note: `Pickup requested for ${pickup.scheduledAt.toDateString()}`,
      });
      await shipment.save();
    } catch (error) {
      shipment.warnings.push(`Pickup not scheduled: ${error instanceof Error ? error.message : 'unknown error'}`);
      await shipment.save();
    }
  }

  return serializeShipment(shipment);
}

/* ------------------------------------------------------------------------- */
/* Tracking / sync                                                            */
/* ------------------------------------------------------------------------- */

function providerForShipment(provider: string): ShippingProvider {
  if (provider === 'DELHIVERY') return delhiveryProvider;
  return shiprocketProvider;
}

export async function syncShipmentById(shipmentId: string) {
  const shipment = await ShipmentModel.findById(shipmentId);
  if (!shipment) throw new ApiError(404, 'Shipment not found.');
  return syncShipment(shipment);
}

export async function syncShipment(shipment: InstanceType<typeof ShipmentModel>) {
  const provider = providerForShipment(shipment.provider);
  if (!provider.isConfigured()) throw new ApiError(503, 'The carrier integration used by this shipment is no longer configured.');
  if (!shipment.awb && !shipment.providerShipmentId) throw new ApiError(400, 'This shipment has no AWB to track yet.');

  const result = await provider.track({ awb: shipment.awb, providerShipmentId: shipment.providerShipmentId });
  const added = mergeEvents(shipment, result.events);
  shipment.status = highestStatus(shipment.status, result.status);
  shipment.lastSyncedAt = new Date();
  if (result.estimatedDeliveryDate) shipment.estimatedDeliveryDate = result.estimatedDeliveryDate;
  if (shipment.status === 'DELIVERED' && !shipment.deliveredAt) shipment.deliveredAt = new Date();
  shipment.payload = { ...(typeof shipment.payload === 'object' && shipment.payload ? shipment.payload : {}), lastTrack: result.raw };
  await shipment.save();

  await applyShipmentToOrder(shipment, added);
  return serializeShipment(shipment);
}

function mergeEvents(shipment: InstanceType<typeof ShipmentModel>, incoming: ShipmentEvent[]): ShipmentEvent[] {
  const existing: ShipmentEvent[] = (shipment.events ?? []).map((e: any) => ({
    status: e.status,
    rawStatus: e.rawStatus,
    at: new Date(e.at).toISOString(),
    note: e.note,
    location: e.location,
  }));
  const key = (e: ShipmentEvent) => `${e.status}|${e.at}|${e.rawStatus}`;
  const seen = new Set(existing.map(key));
  const added: ShipmentEvent[] = [];
  for (const event of incoming) {
    if (seen.has(key(event))) continue;
    seen.add(key(event));
    added.push(event);
    existing.push(event);
  }
  existing.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  shipment.events = existing.slice(0, 100) as any;
  return added;
}

const STATUS_RANK: Record<string, number> = {
  PENDING: 0,
  CREATED: 1,
  PICKUP_SCHEDULED: 2,
  PICKED_UP: 3,
  IN_TRANSIT: 4,
  OUT_FOR_DELIVERY: 5,
  DELIVERED: 6,
};

function highestStatus(current: ShipmentStatus, next: ShipmentStatus): ShipmentStatus {
  // Terminal/non-linear states always win when reported.
  if (['CANCELLED', 'RTO_IN_TRANSIT', 'RTO_DELIVERED', 'EXCEPTION'].includes(next)) return next;
  if (['CANCELLED', 'RTO_DELIVERED'].includes(current) && next !== current) return current;
  return (STATUS_RANK[next] ?? -1) >= (STATUS_RANK[current] ?? -1) ? next : current;
}

const ORDER_RANK: Record<string, number> = {
  PLACED: 0,
  CONFIRMED: 1,
  PACKED: 2,
  SHIPPED: 3,
  OUT_FOR_DELIVERY: 4,
  DELIVERED: 5,
};

const ORDER_TARGET: Partial<Record<ShipmentStatus, 'SHIPPED' | 'OUT_FOR_DELIVERY' | 'DELIVERED'>> = {
  PICKED_UP: 'SHIPPED',
  IN_TRANSIT: 'SHIPPED',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
};

/** Advance the order to match a carrier event, never regressing or touching cancelled orders. */
export async function applyShipmentToOrder(
  shipment: InstanceType<typeof ShipmentModel>,
  added: ShipmentEvent[],
  session?: ClientSession
) {
  const order = await OrderModel.findById(shipment.order).session(session ?? null);
  if (!order || order.status === 'CANCELLED') return;

  order.expectedDeliveryDate = shipment.estimatedDeliveryDate ?? order.expectedDeliveryDate;
  order.courierInfo = {
    name: shipment.courierName || order.courierInfo?.name || '',
    trackingId: shipment.awb || order.courierInfo?.trackingId || '',
    trackingUrl: shipment.trackingUrl || order.courierInfo?.trackingUrl || '',
  };

  const firstEvent = shipment.events?.[0];
  const latest: ShipmentEvent | undefined = firstEvent
    ? {
      status: firstEvent.status as ShipmentStatus,
      rawStatus: firstEvent.rawStatus,
      at: new Date(firstEvent.at).toISOString(),
      note: firstEvent.note,
      location: firstEvent.location,
    }
    : undefined;
  if (latest && (ORDER_TARGET[latest.status] || shipment.status)) {
    const target = ORDER_TARGET[shipment.status] ?? ORDER_TARGET[latest.status];
    if (target && (ORDER_RANK[target] ?? -1) > (ORDER_RANK[order.status] ?? -1)) {
      order.status = target;
      order.statusHistory.push({
        status: target,
        timestamp: new Date(latest?.at ?? Date.now()),
        note: `Courier update: ${latest?.rawStatus ?? shipment.status}${latest?.location ? ` — ${latest.location}` : ''}`,
      });
      if (target === 'DELIVERED' && shipment.status === 'DELIVERED') {
        // COD stays PENDING until an agent/admin records the cash collection.
        if (order.paymentMethod === 'RAZORPAY' && order.paymentStatus === 'PENDING') {
          // Prepaid orders should never reach delivery unpaid; reconcile manually.
          order.statusHistory.push({
            status: target,
            timestamp: new Date(),
            note: 'Delivered with an unpaid online order — verify payment before closing accounts.',
          });
        }
      }
    } else if (added.length) {
      // Still record the carrier scan for the customer timeline.
      order.statusHistory.push({
        status: order.status,
        timestamp: new Date(latest?.at ?? Date.now()),
        note: `Courier: ${latest?.rawStatus ?? shipment.status}${latest?.location ? ` — ${latest.location}` : ''}`,
      });
    }
  }

  await order.save({ session });
  if (added.length || latest) {
    void notifyOrderStatusChange(order._id.toString(), order.status, order.shippingAddress.fullName);
  }
}

/* ------------------------------------------------------------------------- */
/* Webhooks                                                                   */
/* ------------------------------------------------------------------------- */

interface WebhookLookup {
  awb?: string;
  providerOrderId?: string;
  providerShipmentId?: string;
  orderId?: string;
}

export async function findShipmentForWebhook(lookup: WebhookLookup) {
  const or: Record<string, unknown>[] = [];
  if (lookup.awb) or.push({ awb: lookup.awb });
  if (lookup.providerShipmentId) or.push({ providerShipmentId: lookup.providerShipmentId });
  if (lookup.providerOrderId) or.push({ providerOrderId: lookup.providerOrderId });
  if (lookup.orderId) or.push({ order: lookup.orderId });
  if (!or.length) return null;
  return ShipmentModel.findOne({ $or: or });
}

export async function applyCarrierWebhook(
  shipment: InstanceType<typeof ShipmentModel>,
  rawStatus: string,
  at: Date,
  note?: string,
  location?: string
) {
  const status = shipmentStatusFromText(rawStatus);
  const event: ShipmentEvent = {
    status,
    rawStatus,
    at: (Number.isNaN(at.getTime()) ? new Date() : at).toISOString(),
    note: note ?? rawStatus,
    location: location ?? '',
  };

  const existing = new Set((shipment.events ?? []).map((e: any) => `${e.status}|${new Date(e.at).toISOString()}|${e.rawStatus}`));
  if (!existing.has(`${event.status}|${event.at}|${event.rawStatus}`)) {
    const merged = [event, ...(shipment.events ?? []).map((e: any) => ({
      status: e.status, rawStatus: e.rawStatus, at: new Date(e.at).toISOString(), note: e.note, location: e.location,
    }))];
    merged.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    shipment.events = merged.slice(0, 100) as any;
  }
  shipment.status = highestStatus(shipment.status, status);
  shipment.lastSyncedAt = new Date();
  if (status === 'DELIVERED' && !shipment.deliveredAt) shipment.deliveredAt = new Date();
  await shipment.save();
  await applyShipmentToOrder(shipment, [event]);
  return serializeShipment(shipment);
}

/* ------------------------------------------------------------------------- */
/* Cancellation / serialisation                                               */
/* ------------------------------------------------------------------------- */

export async function cancelShipmentForOrder(orderId: string) {
  const shipment = await ShipmentModel.findOne({ order: orderId });
  if (!shipment || ['CANCELLED', 'DELIVERED', 'RTO_DELIVERED'].includes(shipment.status)) return;
  try {
    const provider = providerForShipment(shipment.provider);
    if (provider.isConfigured()) {
      await provider.cancelShipment({
        providerOrderId: shipment.providerOrderId,
        providerShipmentId: shipment.providerShipmentId,
        awb: shipment.awb,
      });
    }
    shipment.status = 'CANCELLED';
    shipment.events = [
      {
        status: 'CANCELLED',
        rawStatus: 'Shipment cancelled',
        at: new Date().toISOString(),
        note: 'Cancelled by the shop',
      },
      ...(shipment.events ?? []).map((e: any) => ({
        status: e.status, rawStatus: e.rawStatus, at: new Date(e.at).toISOString(), note: e.note, location: e.location,
      })),
    ] as any;
    await shipment.save();
  } catch (error) {
    shipment.warnings.push(`Cancellation failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    await shipment.save();
    console.error('[shipping] Cancel failed for order', orderId, error);
  }
}

export function serializeShipment(shipment: InstanceType<typeof ShipmentModel> | any) {
  const order = shipment.order && typeof shipment.order === 'object' && '_id' in shipment.order
    ? shipment.order
    : null;
  return {
    id: String(shipment._id),
    order: order ? String(order._id) : String(shipment.order),
    orderNumber: orderNumber(String(order?._id ?? shipment.order)),
    provider: shipment.provider,
    providerOrderId: shipment.providerOrderId ?? '',
    providerShipmentId: shipment.providerShipmentId ?? '',
    status: shipment.status,
    courierCode: shipment.courierCode ?? null,
    courierName: shipment.courierName ?? '',
    awb: shipment.awb ?? '',
    trackingUrl: shipment.trackingUrl ?? '',
    labelUrl: shipment.provider === 'DELHIVERY'
      ? `/api/admin/shipments/${shipment._id}/label`
      : shipment.labelUrl ?? '',
    manifestUrl: shipment.manifestUrl ?? '',
    weight: shipment.weight ?? 0,
    length: shipment.length ?? 0,
    breadth: shipment.breadth ?? 0,
    height: shipment.height ?? 0,
    codAmount: shipment.codAmount ?? 0,
    charge: shipment.charge ?? 0,
    pickupScheduledAt: shipment.pickupScheduledAt ?? null,
    estimatedDeliveryDate: shipment.estimatedDeliveryDate ?? null,
    deliveredAt: shipment.deliveredAt ?? null,
    events: (shipment.events ?? []).map((e: any) => ({
      status: e.status,
      rawStatus: e.rawStatus ?? '',
      at: new Date(e.at).toISOString(),
      note: e.note ?? '',
      location: e.location ?? '',
    })),
    warnings: shipment.warnings ?? [],
    createdAt: shipment.createdAt,
    updatedAt: shipment.updatedAt,
  };
}

/** Customer-safe shipment snapshot embedded in order/tracking responses. */
export function shipmentSummary(shipment: InstanceType<typeof ShipmentModel> | any) {
  if (!shipment) return null;
  return {
    id: String(shipment._id),
    status: shipment.status,
    provider: shipment.provider,
    courierCode: shipment.courierCode ?? null,
    courierName: shipment.courierName ?? '',
    awb: shipment.awb ?? '',
    trackingUrl: shipment.trackingUrl ?? '',
    labelUrl: '',
    estimatedDeliveryDate: shipment.estimatedDeliveryDate ?? null,
    events: (shipment.events ?? []).slice(0, 30).map((e: any) => ({
      status: e.status,
      rawStatus: e.rawStatus ?? '',
      at: new Date(e.at).toISOString(),
      note: e.note ?? '',
      location: e.location ?? '',
    })),
    updatedAt: shipment.updatedAt,
  };
}

/** Stream a Delhivery packing slip through our authenticated backend. */
export async function fetchDelhiveryLabel(awb: string): Promise<Response> {
  if (!delhiveryEnabled) throw new ApiError(503, 'Delhivery is not configured.');
  const response = await fetch(delhiveryLabelUrl(awb), {
    headers: { Authorization: `Token ${env.delhiveryApiToken}`, Accept: 'application/pdf' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new ApiError(502, 'Delhivery did not return the packing slip.');
  return response;
}
