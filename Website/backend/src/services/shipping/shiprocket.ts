import { env, shiprocketEnabled } from '../../config/env.js';
import { COURIERS, courierCodeFromName, shipmentStatusFromText, type CourierQuote } from '@shared/shipping.js';
import {
  ShippingProviderError,
  addDays,
  nameParts,
  normalizePhone,
  parseDayRange,
  providerFetch,
  roundMoney,
  sanitizeText,
  toQuote,
  type CreateShipmentResult,
  type PickupResult,
  type ShippingOrderInput,
  type ShippingProvider,
  type TrackResult,
} from './provider.js';

/**
 * Shiprocket aggregator adapter.
 *
 * One credential set reaches Ekart, Delhivery, Blue Dart, DTDC, XpressBees,
 * Shadowfax and more. This is the recommended production connection for a
 * single-store shop because carrier selection, pickup and labels all work
 * through one API and one reconciliation flow.
 *
 * API reference: https://apidocs.shiprocket.in/
 */

const BASE = env.shiprocketBaseUrl.replace(/\/$/, '');
const API = `${BASE}/v1/external`;

let token: string | null = null;
let tokenExpiresAt = 0;

async function authenticate(force = false): Promise<string> {
  if (!shiprocketEnabled) throw new ShippingProviderError('Shiprocket', 'Credentials are not configured.', 503);
  if (!force && token && Date.now() < tokenExpiresAt) return token;

  const { data } = await providerFetch<{ token?: string; message?: string }>(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: env.shiprocketEmail, password: env.shiprocketPassword }),
  });

  if (!data?.token) {
    throw new ShippingProviderError('Shiprocket', data?.message ?? 'Login failed. Check the email/password.', 502, data);
  }
  token = data.token;
  // Shiprocket tokens are valid for 10 days; refresh a day early.
  tokenExpiresAt = Date.now() + 9 * 24 * 60 * 60 * 1000;
  return token;
}

async function api<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const auth = await authenticate();
  try {
    const { data } = await providerFetch<T>(`${API}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth}`,
        ...(init.headers ?? {}),
      },
    });
    return data;
  } catch (error) {
    // Expired/revoked token: re-authenticate once, then retry the same call.
    if (retry && error instanceof Error && /HTTP 401|HTTP 403/.test(error.message)) {
      await authenticate(true);
      return api<T>(path, init, false);
    }
    throw error;
  }
}

interface ShiprocketCourier {
  courier_company_id?: number | string;
  courier_name?: string;
  rate?: number | string;
  cod?: number | string;
  cod_charges?: number | string;
  estimated_delivery_days?: string | number;
  estimated_delivery_date?: string;
  freight_charges?: number | string;
}

function courierQuotes(rows: ShiprocketCourier[], cod: boolean): CourierQuote[] {
  const seen = new Set<string>();
  const quotes: CourierQuote[] = [];
  for (const row of rows) {
    const name = String(row.courier_name ?? '').trim();
    if (!name) continue;
    const code = courierCodeFromName(name);
    // Keep only couriers the shop recognises; unknown partners are still
    // usable, but exposed under the aggregator label.
    const courierCode = code ?? 'SHIPROCKET';
    const key = `${courierCode}:${row.courier_company_id ?? name}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const codSupported =
      row.cod === undefined ? true : [1, '1', true, 'true'].includes(row.cod as never) || Number(row.cod) === 1;
    if (cod && !codSupported) continue;

    const days = parseDayRange(row.estimated_delivery_days);
    const rate = Number(row.rate ?? row.freight_charges ?? 0);
    quotes.push(
      toQuote({
        provider: 'SHIPROCKET',
        courierCode,
        courierName: name,
        rate: Number.isFinite(rate) ? rate : 0,
        codAvailable: codSupported,
        min: days.min,
        max: days.max,
        providerCourierId: row.courier_company_id ? String(row.courier_company_id) : undefined,
      })
    );
  }
  quotes.sort((a, b) => a.estimatedDaysMax - b.estimatedDaysMax || a.rate - b.rate);
  return quotes;
}

export const shiprocketProvider: ShippingProvider = {
  code: 'SHIPROCKET',

  isConfigured() {
    return shiprocketEnabled;
  },

  async serviceability(originPincode, destinationPincode, weightKg, cod) {
    const params = new URLSearchParams({
      pickup_postcode: originPincode,
      delivery_postcode: destinationPincode,
      weight: String(Math.max(0.1, weightKg)),
      cod: cod ? '1' : '0',
    });
    const data = await api<{
      data?: { available_courier_companies?: ShiprocketCourier[]; message?: string };
      message?: string;
    }>(`/courier/serviceability/?${params.toString()}`);

    const rows = data?.data?.available_courier_companies ?? [];
    if (!rows.length) {
      throw new ShippingProviderError(
        'Shiprocket',
        data?.message ?? data?.data?.message ?? `No courier serves pincode ${destinationPincode}.`,
        422,
        data
      );
    }
    return courierQuotes(rows, cod);
  },

  async createShipment(input, pickupLocation) {
    const customer = nameParts(input.customer.name);
    const payload = {
      order_id: input.orderId,
      order_date: input.createdAt.toISOString().slice(0, 19).replace('T', ' '),
      pickup_location: pickupLocation,
      channel_id: '',
      comment: `Order ${input.orderNumber}`,
      billing_customer_name: customer.first,
      billing_last_name: customer.last,
      billing_address: sanitizeText(input.customer.addressLine1, 190),
      billing_address_2: sanitizeText(input.customer.addressLine2, 190),
      billing_city: sanitizeText(input.customer.city, 80),
      billing_pincode: input.customer.pincode,
      billing_state: sanitizeText(input.customer.state, 80),
      billing_country: 'India',
      billing_email: input.customer.email || 'orders@example.com',
      billing_phone: normalizePhone(input.customer.phone),
      shipping_is_billing: true,
      order_items: input.items.map((item) => ({
        name: sanitizeText(item.title, 190),
        sku: sanitizeText(item.sku || item.title, 60),
        units: Math.max(1, item.quantity),
        selling_price: roundMoney(item.unitPrice),
        discount: 0,
        tax: 0,
        hsn: '',
      })),
      payment_method: input.paymentMethod === 'COD' ? 'COD' : 'Prepaid',
      shipping_charges: 0,
      giftwrap_charges: 0,
      transaction_charges: 0,
      sub_total: roundMoney(input.itemsTotal),
      length: input.dimensions.length,
      breadth: input.dimensions.breadth,
      height: input.dimensions.height,
      weight: input.weightKg,
      ...(input.paymentMethod === 'COD' && input.codAmount > 0 ? { cod_amount: roundMoney(input.codAmount) } : {}),
    };

    const created = await api<Record<string, any>>('/orders/create/adhoc', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const providerOrderId = String(created.order_id ?? '');
    const providerShipmentId = String(created.shipment_id ?? '');
    if (!providerShipmentId && !providerOrderId) {
      const message = created.message ?? JSON.stringify(created).slice(0, 300);
      throw new ShippingProviderError('Shiprocket', `Order creation failed: ${message}`, 502, created);
    }

    const warnings: string[] = [];
    let awb = '';
    let courierName = '';
    let labelUrl = '';
    let charge = 0;

    if (providerShipmentId) {
      try {
        const assigned = await assignAwb(providerShipmentId, input.preferredCourierId);
        awb = assigned.awb;
        courierName = assigned.courierName;
        charge = assigned.charge;
      } catch (error) {
        warnings.push(`AWB assignment pending: ${messageOf(error)}`);
      }
    }

    if (providerShipmentId) {
      try {
        labelUrl = await generateLabel(providerShipmentId);
      } catch (error) {
        warnings.push(`Label pending: ${messageOf(error)}`);
      }
    }

    // Some accounts return the AWB directly on creation.
    if (!awb && created.awb_code) awb = String(created.awb_code);
    if (!courierName && created.courier_name) courierName = String(created.courier_name);
    if (!labelUrl && created.label_url) labelUrl = String(created.label_url);

    return {
      providerOrderId,
      providerShipmentId,
      awb,
      courierName,
      labelUrl,
      trackingUrl: awb ? COURIERS[courierCodeFromName(courierName) ?? 'SHIPROCKET'].trackingUrl(awb) : '',
      charge,
      warnings,
      payload: { create: created, assigned: { awb, courierName } },
    } satisfies CreateShipmentResult;
  },

  async schedulePickup(shipment, pickupDate) {
    const body: Record<string, unknown> = {
      shipment_id: [shipment.providerShipmentId].filter(Boolean),
    };
    if (pickupDate) body.pickup_date = pickupDate.toISOString().slice(0, 10);

    // Newer accounts use /courier/generate/pickup; older ones /courier/generate/pickup/.
    const data = await api<Record<string, any>>('/courier/generate/pickup', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const raw = JSON.stringify(data ?? {});
    if (/error|failed|not\s*assigned/i.test(raw) && !/pickup_status\s*:\s*(true|1|"generated")/i.test(raw)) {
      throw new ShippingProviderError('Shiprocket', data?.message ?? 'Pickup request was not accepted.', 502, data);
    }
    const scheduledAt = pickupDate ? startOfDay(pickupDate) : new Date();
    return { scheduledAt, raw: data } satisfies PickupResult;
  },

  async cancelShipment(shipment) {
    if (!shipment.providerOrderId) throw new ShippingProviderError('Shiprocket', 'Missing provider order id.', 400);
    const data = await api<Record<string, any>>('/orders/cancel', {
      method: 'POST',
      body: JSON.stringify({ ids: [Number(shipment.providerOrderId) || shipment.providerOrderId] }),
    });
    if (/error/i.test(JSON.stringify(data ?? {}))) {
      throw new ShippingProviderError('Shiprocket', data?.message ?? 'Cancellation was rejected.', 502, data);
    }
  },

  async track(shipment) {
    if (!shipment.awb) throw new ShippingProviderError('Shiprocket', 'No AWB to track yet.', 400);
    const data = await api<Record<string, any>>(`/courier/track/awb/${encodeURIComponent(shipment.awb)}`);
    const tracking = data?.tracking_data ?? data;
    const activities =
      tracking?.shipment_track_activities ??
      tracking?.shipment_track?.[0]?.activities ??
      tracking?.activities ??
      [];

    const events = (Array.isArray(activities) ? activities : []).map((activity: Record<string, any>) => {
      const rawStatus = String(activity.activity ?? activity.status ?? activity['sr-status-label'] ?? 'Update');
      const at = new Date(activity.date ?? activity['sr-status-date'] ?? activity.updated_at ?? Date.now());
      return {
        status: shipmentStatusFromText(rawStatus),
        rawStatus,
        at: (Number.isNaN(at.getTime()) ? new Date() : at).toISOString(),
        note: String(activity.activity ?? activity.status ?? '').slice(0, 300),
        location: String(activity.location ?? '').slice(0, 120),
      };
    });

    const currentRaw = String(
      tracking?.shipment_status ??
        tracking?.current_status ??
        tracking?.shipment_track?.[0]?.current_status ??
        events[0]?.rawStatus ??
        'In transit'
    );
    const status = shipmentStatusFromText(currentRaw);
    const eta = tracking?.etd ? new Date(tracking.etd) : null;

    return {
      status,
      events,
      estimatedDeliveryDate: eta && !Number.isNaN(eta.getTime()) ? eta : null,
      raw: data,
    } satisfies TrackResult;
  },
};

async function assignAwb(shipmentId: string, courierId?: string) {
  const body: Record<string, unknown> = { shipment_id: shipmentId };
  if (courierId) body.courier_id = Number(courierId) || courierId;
  const data = await api<Record<string, any>>('/courier/assign/awb', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const response = data?.response?.data ?? data?.data ?? data;
  const awb = String(response?.awb_code ?? data?.awb_code ?? '');
  if (!awb) {
    throw new ShippingProviderError('Shiprocket', data?.message ?? 'No AWB returned by the courier.', 502, data);
  }
  return {
    awb,
    courierName: String(response?.courier_name ?? data?.courier_name ?? ''),
    charge: Number(response?.freight_charges ?? response?.charge ?? 0) || 0,
  };
}

async function generateLabel(shipmentId: string): Promise<string> {
  const data = await api<Record<string, any>>('/courier/generate/label', {
    method: 'POST',
    body: JSON.stringify({ shipment_id: [Number(shipmentId) || shipmentId] }),
  });
  return String(data?.label_url ?? data?.response?.label_url ?? data?.data?.label_url ?? '');
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message.replace(/^Shiprocket:\s*/, '') : 'Unknown carrier error';
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(10, 0, 0, 0);
  return copy;
}

export { addDays };
