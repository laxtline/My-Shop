import type { CourierQuote, ServiceabilityResult, ShipmentEvent, ShipmentStatus } from '@shared/shipping.js';

export interface ShippingOrderItem {
  title: string;
  sku: string;
  quantity: number;
  unitPrice: number;
}

export interface ShippingOrderInput {
  orderId: string;
  orderNumber: string;
  createdAt: Date;
  paymentMethod: 'COD' | 'RAZORPAY';
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED';
  codAmount: number;
  itemsTotal: number;
  total: number;
  items: ShippingOrderItem[];
  customer: {
    name: string;
    phone: string;
    email: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    pincode: string;
  };
  weightKg: number;
  dimensions: { length: number; breadth: number; height: number };
  /** Provider-specific courier id to force, from a previous quote. */
  preferredCourierId?: string;
  preferredCourierName?: string;
}

export interface CreateShipmentResult {
  providerOrderId: string;
  providerShipmentId: string;
  awb: string;
  courierName: string;
  labelUrl: string;
  trackingUrl: string;
  charge: number;
  warnings: string[];
  payload: unknown;
}

export interface TrackResult {
  status: ShipmentStatus;
  events: ShipmentEvent[];
  estimatedDeliveryDate?: Date | null;
  raw: unknown;
}

export interface PickupResult {
  scheduledAt: Date;
  raw: unknown;
}

export interface ShippingProvider {
  code: 'SHIPROCKET' | 'DELHIVERY';
  isConfigured(): boolean;
  serviceability(
    originPincode: string,
    destinationPincode: string,
    weightKg: number,
    cod: boolean
  ): Promise<CourierQuote[]>;
  createShipment(input: ShippingOrderInput, pickupLocation: string): Promise<CreateShipmentResult>;
  schedulePickup(shipment: { providerOrderId: string; providerShipmentId: string; awb: string }, pickupDate?: Date): Promise<PickupResult>;
  cancelShipment(shipment: { providerOrderId: string; providerShipmentId: string; awb: string }): Promise<void>;
  track(shipment: { awb: string; providerShipmentId: string }): Promise<TrackResult>;
}

export class ShippingProviderError extends Error {
  status: number;
  provider: string;
  details?: unknown;

  constructor(provider: string, message: string, status = 502, details?: unknown) {
    super(`${provider}: ${message}`);
    this.name = 'ShippingProviderError';
    this.provider = provider;
    this.status = status;
    this.details = details;
  }
}

const DEFAULT_TIMEOUT_MS = 15_000;

/** fetch() with a timeout, JSON parsing and compact provider error messages. */
export async function providerFetch<T = unknown>(
  url: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<{ data: T; status: number }> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    throw new Error(
      error instanceof Error && error.name === 'TimeoutError'
        ? 'The carrier API timed out. Please retry.'
        : 'Could not reach the carrier API. Check the server network connection.'
    );
  }

  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const detail =
      typeof data === 'object' && data !== null
        ? JSON.stringify(data).slice(0, 400)
        : String(data ?? '').slice(0, 400);
    throw new Error(`HTTP ${response.status}${detail ? ` — ${detail}` : ''}`);
  }
  return { data: data as T, status: response.status };
}

/** Indian mobile numbers are accepted by carriers in 10-digit form. */
export function normalizePhone(value: string): string {
  return value.replace(/\D/g, '').slice(-10);
}

/** Carriers require each name part to stay short and printable. */
export function nameParts(fullName: string): { first: string; last: string } {
  const cleaned = fullName.replace(/[^\p{L}\p{N}\s.'-]/gu, '').trim().replace(/\s+/g, ' ');
  const parts = cleaned.split(' ').filter(Boolean);
  return {
    first: (parts[0] ?? 'Customer').slice(0, 50),
    last: (parts.slice(1).join(' ') || 'Customer').slice(0, 50),
  };
}

export function sanitizeText(value: string, max = 200): string {
  return value.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/** Best-effort parse of "2-4", "3", "2 to 4" day strings. */
export function parseDayRange(value: unknown): { min: number; max: number } {
  if (Array.isArray(value) && value.length >= 2) {
    return { min: Math.max(0, Number(value[0]) || 0), max: Math.max(0, Number(value[1]) || 0) };
  }
  const text = String(value ?? '');
  const numbers = text.match(/\d+/g)?.map(Number) ?? [];
  if (!numbers.length) return { min: 2, max: 5 };
  return { min: numbers[0], max: numbers[1] ?? numbers[0] };
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Turn a provider response into the public, customer-safe quote shape. */
export function toQuote(input: {
  provider: 'SHIPROCKET' | 'DELHIVERY';
  courierCode: CourierQuote['courierCode'];
  courierName: string;
  rate: number;
  codAvailable: boolean;
  min: number;
  max: number;
  providerCourierId?: string;
}): CourierQuote {
  return {
    provider: input.provider,
    courierCode: input.courierCode,
    courierName: input.courierName,
    rate: roundMoney(input.rate),
    codAvailable: input.codAvailable,
    estimatedDaysMin: input.min,
    estimatedDaysMax: input.max,
    providerCourierId: input.providerCourierId,
  };
}

/**
 * Serviceability response without live credentials. Kept separate so the
 * estimator never pretends to be a live carrier quote.
 */
export function estimatedServiceability(args: {
  pincode: string;
  deliveryFee: number;
  codFee: number;
  freeDeliveryOver: number;
  codAvailable: boolean;
  min: number;
  max: number;
  message?: string;
}): ServiceabilityResult {
  return {
    pincode: args.pincode,
    serviceable: true,
    codAvailable: args.codAvailable,
    deliveryFee: args.deliveryFee,
    codFee: args.codFee,
    freeDeliveryOver: args.freeDeliveryOver,
    estimatedDaysMin: args.min,
    estimatedDaysMax: args.max,
    source: 'estimate',
    options: [],
    message: args.message,
    checkedAt: new Date().toISOString(),
  };
}
