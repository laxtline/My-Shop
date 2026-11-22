import { delhiveryEnabled, env } from '../../config/env.js';
import {
  COURIERS,
  estimateDelivery,
  shipmentStatusFromText,
  type CourierQuote,
  type ShipmentEvent,
} from '@shared/shipping.js';
import {
  ShippingProviderError,
  nameParts,
  normalizePhone,
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
 * Direct Delhivery adapter (B2C surface).
 *
 * Use this when the shop has its own Delhivery contract. For Ekart, Blue Dart
 * and multi-carrier selection, use the Shiprocket aggregator instead.
 *
 * API reference: https://documentation.delhivery.com/
 */

const BASE = env.delhiveryBaseUrl.replace(/\/$/, '');

function headers(): Record<string, string> {
  return {
    Authorization: `Token ${env.delhiveryApiToken}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!delhiveryEnabled) throw new ShippingProviderError('Delhivery', 'API token is not configured.', 503);
  const { data } = await providerFetch<T>(`${BASE}${path}`, {
    ...init,
    headers: { ...headers(), ...(init.headers ?? {}) },
  });
  return data;
}

export const delhiveryProvider: ShippingProvider = {
  code: 'DELHIVERY',

  isConfigured() {
    return delhiveryEnabled;
  },

  async serviceability(originPincode, destinationPincode, _weightKg, cod) {
    const data = await api<Record<string, any>>(
      `/c/api/pin-codes/json/?filter_codes=${encodeURIComponent(destinationPincode)}`
    );
    const rows: Record<string, any>[] = Array.isArray(data?.delivery_codes)
      ? data.delivery_codes.map((row: Record<string, any>) => row.postal_code ?? row)
      : [];

    const match = rows.find((row) => String(row.pin ?? row.postal_code ?? '') === destinationPincode) ?? rows[0];
    if (!match) {
      throw new ShippingProviderError('Delhivery', `Pincode ${destinationPincode} is not served.`, 422, data);
    }
    const codSupported = String(match.cod ?? 'Y').toUpperCase() !== 'N';
    if (cod && !codSupported) return [];

    const eta = estimateDelivery(originPincode, destinationPincode);
    return [
      toQuote({
        provider: 'DELHIVERY',
        courierCode: 'DELHIVERY',
        courierName: 'Delhivery',
        // Delhivery's pincode API does not quote freight; admin sees 0 until
        // the invoice is reconciled.
        rate: 0,
        codAvailable: codSupported,
        min: eta.min,
        max: eta.max,
      }),
    ];
  },

  async createShipment(input, pickupLocation) {
    const customer = nameParts(input.customer.name);
    const consignee = {
      name: `${customer.first} ${customer.last}`.trim(),
      add: sanitizeText(`${input.customer.addressLine1} ${input.customer.addressLine2}`, 250),
      pin: input.customer.pincode,
      city: sanitizeText(input.customer.city, 80),
      state: sanitizeText(input.customer.state, 80),
      country: 'India',
      phone: normalizePhone(input.customer.phone),
      order: input.orderId,
      payment_mode: input.paymentMethod === 'COD' ? 'COD' : 'Prepaid',
      products_desc: sanitizeText(input.items.map((i) => i.title).join(', '), 250),
      cod_amount: input.paymentMethod === 'COD' ? roundMoney(input.codAmount) : 0,
      order_date: input.createdAt.toISOString().slice(0, 19).replace('T', ' '),
      total_amount: roundMoney(input.total),
      seller_name: sanitizeText(env.delhiveryClientName || 'Store', 100),
      seller_add: sanitizeText(`${input.customer.city}, ${input.customer.state}`, 200),
      seller_inv: input.orderNumber,
      quantity: input.items.reduce((sum, item) => sum + item.quantity, 0),
      waybill: '',
      shipment_width: input.dimensions.breadth,
      shipment_height: input.dimensions.height,
      shipment_length: input.dimensions.length,
      weight: input.weightKg,
      shipping_mode: 'Surface',
      address_type: 'home',
    };

    const payload = {
      shipments: [consignee],
      pickup_location: { name: pickupLocation },
    };

    const body = new URLSearchParams({ format: 'json', data: JSON.stringify(payload) }).toString();
    const data = await api<Record<string, any>>('/api/cmu/create.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const pkg = Array.isArray(data?.packages) ? data.packages[0] : null;
    const awb = String(pkg?.waybill ?? data?.waybill ?? '');
    if (!awb) {
      const message = String(data?.rmk ?? data?.error ?? JSON.stringify(data ?? {}).slice(0, 300));
      throw new ShippingProviderError('Delhivery', `Shipment creation failed: ${message}`, 502, data);
    }

    return {
      providerOrderId: String(pkg?.refnum ?? input.orderId),
      providerShipmentId: awb,
      awb,
      courierName: 'Delhivery',
      // The packing slip requires our API token, so the backend serves it
      // through an authenticated proxy route.
      labelUrl: '',
      trackingUrl: COURIERS.DELHIVERY.trackingUrl(awb),
      charge: Number(pkg?.charged_weight ?? 0) || 0,
      warnings: [],
      payload: data,
    } satisfies CreateShipmentResult;
  },

  async schedulePickup(shipment, pickupDate) {
    const date = (pickupDate ?? new Date()).toISOString().slice(0, 10);
    const data = await api<Record<string, any>>('/fm/request/new/', {
      method: 'POST',
      body: JSON.stringify({
        pickup_location: { name: env.delhiveryPickupLocation },
        pickup_date: date,
        pickup_time: '10:00:00',
        expected_package_count: 1,
      }),
    });
    if (data?.success === false || data?.error) {
      throw new ShippingProviderError('Delhivery', String(data?.error ?? 'Pickup was rejected.'), 502, data);
    }
    const scheduledAt = new Date(`${date}T10:00:00`);
    return { scheduledAt, raw: data } satisfies PickupResult;
  },

  async cancelShipment(shipment) {
    if (!shipment.awb) throw new ShippingProviderError('Delhivery', 'No AWB to cancel.', 400);
    const data = await api<Record<string, any>>('/api/p/edit', {
      method: 'POST',
      body: JSON.stringify({ waybill: shipment.awb, cancellation: 'true' }),
    });
    if (data?.status === false || data?.error) {
      throw new ShippingProviderError('Delhivery', String(data?.error ?? 'Cancellation was rejected.'), 502, data);
    }
  },

  async track(shipment) {
    if (!shipment.awb) throw new ShippingProviderError('Delhivery', 'No AWB to track yet.', 400);
    const data = await api<Record<string, any>>(
      `/api/v1/packages/?waybill=${encodeURIComponent(shipment.awb)}`
    );
    const node =
      data?.ShipmentData?.[0]?.Shipment ??
      data?.data?.shipments?.[0] ??
      data?.shipments?.[0] ??
      null;

    if (!node) {
      throw new ShippingProviderError('Delhivery', 'No tracking data returned for this AWB.', 404, data);
    }

    const events: ShipmentEvent[] = [];
    const scans = node?.Scans ?? node?.scans ?? [];
    for (const scan of Array.isArray(scans) ? scans : []) {
      const detail = scan?.ScanDetail ?? scan?.scan_detail ?? scan;
      const raw = String(detail?.Scan ?? detail?.scan ?? detail?.Status ?? '').trim();
      if (!raw) continue;
      const at = new Date(detail?.ScanDateTime ?? detail?.scan_date_time ?? Date.now());
      events.push({
        status: shipmentStatusFromText(raw),
        rawStatus: raw,
        at: (Number.isNaN(at.getTime()) ? new Date() : at).toISOString(),
        note: raw.slice(0, 300),
        location: String(detail?.ScannedLocation ?? detail?.scanned_location ?? '').slice(0, 120),
      });
    }

    const statusNode = node?.Status ?? node?.status ?? {};
    const currentRaw = String(statusNode?.Status ?? statusNode?.status ?? '').trim();
    if (currentRaw) {
      const at = new Date(statusNode?.StatusDateTime ?? statusNode?.status_date_time ?? Date.now());
      const event: ShipmentEvent = {
        status: shipmentStatusFromText(currentRaw),
        rawStatus: currentRaw,
        at: (Number.isNaN(at.getTime()) ? new Date() : at).toISOString(),
        note: String(statusNode?.Instructions ?? '').slice(0, 300),
        location: String(statusNode?.StatusLocation ?? '').slice(0, 120),
      };
      if (!events.some((e) => e.rawStatus === event.rawStatus && e.at === event.at)) events.push(event);
    }

    // Newest first for display; the shipment document stores de-duplicated.
    events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    const latest = events[0]?.rawStatus ?? currentRaw ?? 'In transit';
    const etaRaw = node?.ExpectedDeliveryDate ?? node?.expected_delivery_date;
    const eta = etaRaw ? new Date(etaRaw) : null;

    return {
      status: currentRaw ? shipmentStatusFromText(currentRaw) : shipmentStatusFromText(latest),
      events,
      estimatedDeliveryDate: eta && !Number.isNaN(eta.getTime()) ? eta : null,
      raw: data,
    } satisfies TrackResult;
  },
};

/** Delhivery packing slip (PDF) fetched server-side with the API token. */
export function delhiveryLabelUrl(awb: string): string {
  return `${BASE}/api/p/packing_slip?wbns=${encodeURIComponent(awb)}&pdf=true`;
}

export { addDays } from './provider.js';
