// Shared shipping domain types + courier registry.
// Used by the backend (provider adapters), the website (serviceability UI) and
// the mobile app (checkout ETA). Keep this file dependency-free.

export type CourierCode =
  | 'SHIPROCKET'
  | 'DELHIVERY'
  | 'EKART'
  | 'BLUEDART'
  | 'DTDC'
  | 'XPRESSBEES'
  | 'SHADOWFAX'
  | 'INDIA_POST';

export type CourierMode = 'AGGREGATOR' | 'DIRECT' | 'MANUAL';

export interface CourierMeta {
  code: CourierCode;
  name: string;
  /** How this courier is reached: through an aggregator, directly, or manually. */
  mode: CourierMode;
  /** Public tracking page used when the provider gives us no URL. */
  trackingUrl: (awb: string) => string;
  supportsCod: boolean;
  supportsPickup: boolean;
  /** Provider that fulfils this courier code. */
  provider: 'SHIPROCKET' | 'DELHIVERY' | 'MANUAL';
}

export const COURIERS: Record<CourierCode, CourierMeta> = {
  SHIPROCKET: {
    code: 'SHIPROCKET',
    name: 'Shiprocket (auto-best courier)',
    mode: 'AGGREGATOR',
    trackingUrl: (awb) => `https://shiprocket.co/tracking/${encodeURIComponent(awb)}`,
    supportsCod: true,
    supportsPickup: true,
    provider: 'SHIPROCKET',
  },
  DELHIVERY: {
    code: 'DELHIVERY',
    name: 'Delhivery',
    mode: 'AGGREGATOR',
    trackingUrl: (awb) => `https://www.delhivery.com/track/package/${encodeURIComponent(awb)}`,
    supportsCod: true,
    supportsPickup: true,
    provider: 'SHIPROCKET',
  },
  EKART: {
    code: 'EKART',
    name: 'Ekart Logistics',
    mode: 'AGGREGATOR',
    trackingUrl: (awb) => `https://ekartlogistics.com/track/${encodeURIComponent(awb)}`,
    supportsCod: true,
    supportsPickup: true,
    provider: 'SHIPROCKET',
  },
  BLUEDART: {
    code: 'BLUEDART',
    name: 'Blue Dart',
    mode: 'AGGREGATOR',
    trackingUrl: (awb) => `https://www.bluedart.com/tracking?trackFor=0&trackNo=${encodeURIComponent(awb)}`,
    supportsCod: true,
    supportsPickup: true,
    provider: 'SHIPROCKET',
  },
  DTDC: {
    code: 'DTDC',
    name: 'DTDC',
    mode: 'AGGREGATOR',
    trackingUrl: (awb) => `https://www.dtdc.in/tracking/tracking_results.asp?strCnno=${encodeURIComponent(awb)}`,
    supportsCod: true,
    supportsPickup: true,
    provider: 'SHIPROCKET',
  },
  XPRESSBEES: {
    code: 'XPRESSBEES',
    name: 'XpressBees',
    mode: 'AGGREGATOR',
    trackingUrl: (awb) => `https://www.xpressbees.com/shipment/tracking?awbNo=${encodeURIComponent(awb)}`,
    supportsCod: true,
    supportsPickup: true,
    provider: 'SHIPROCKET',
  },
  SHADOWFAX: {
    code: 'SHADOWFAX',
    name: 'Shadowfax',
    mode: 'AGGREGATOR',
    trackingUrl: (awb) => `https://track.shadowfax.in/#/track/${encodeURIComponent(awb)}`,
    supportsCod: true,
    supportsPickup: true,
    provider: 'SHIPROCKET',
  },
  INDIA_POST: {
    code: 'INDIA_POST',
    name: 'India Post',
    mode: 'MANUAL',
    trackingUrl: (awb) => `https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx`,
    supportsCod: true,
    supportsPickup: false,
    provider: 'MANUAL',
  },
};

export const COURIER_LIST: CourierMeta[] = Object.values(COURIERS);

/** Normalise a carrier's free-text courier name to a known code. */
export function courierCodeFromName(name: string): CourierCode | null {
  const n = name.toLowerCase().replace(/[^a-z]/g, '');
  if (n.includes('ekart')) return 'EKART';
  if (n.includes('bluedart')) return 'BLUEDART';
  if (n.includes('delhivery')) return 'DELHIVERY';
  if (n.includes('xpressbees')) return 'XPRESSBEES';
  if (n.includes('shadowfax')) return 'SHADOWFAX';
  if (n.includes('dtdc')) return 'DTDC';
  if (n.includes('indiapost') || n.includes('speedpost')) return 'INDIA_POST';
  if (n.includes('shiprocket')) return 'SHIPROCKET';
  return null;
}

export type ShipmentStatus =
  | 'PENDING'
  | 'CREATED'
  | 'PICKUP_SCHEDULED'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'RTO_IN_TRANSIT'
  | 'RTO_DELIVERED'
  | 'EXCEPTION'
  | 'CANCELLED';

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  PENDING: 'Awaiting pickup',
  CREATED: 'Shipment created',
  PICKUP_SCHEDULED: 'Pickup scheduled',
  PICKED_UP: 'Picked up',
  IN_TRANSIT: 'In transit',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  RTO_IN_TRANSIT: 'Returning to origin',
  RTO_DELIVERED: 'Returned to origin',
  EXCEPTION: 'Delivery exception',
  CANCELLED: 'Cancelled',
};

/** Map any carrier text into our canonical shipment status. */
export function shipmentStatusFromText(raw: string): ShipmentStatus {
  const s = raw.toLowerCase();
  if (s.includes('rto') && s.includes('deliver')) return 'RTO_DELIVERED';
  if (s.includes('rto')) return 'RTO_IN_TRANSIT';
  if (s.includes('cancel')) return 'CANCELLED';
  if (s.includes('delivered') && !s.includes('out for')) return 'DELIVERED';
  if (s.includes('out for delivery') || s.includes('out-for-delivery')) return 'OUT_FOR_DELIVERY';
  if (s.includes('picked') || s.includes('pickup complete')) return 'PICKED_UP';
  if (s.includes('pickup') && (s.includes('scheduled') || s.includes('assigned') || s.includes('generated'))) {
    return 'PICKUP_SCHEDULED';
  }
  if (s.includes('transit') || s.includes('dispatch') || s.includes('received at') || s.includes('reached')) {
    return 'IN_TRANSIT';
  }
  if (s.includes('exception') || s.includes('undeliver') || s.includes('failed') || s.includes('not available')) {
    return 'EXCEPTION';
  }
  if (s.includes('created') || s.includes('manifest') || s.includes('label')) return 'CREATED';
  return 'PENDING';
}

export interface ShipmentEvent {
  status: ShipmentStatus;
  rawStatus: string;
  at: string;
  note?: string;
  location?: string;
}

export interface CourierQuote {
  provider: 'SHIPROCKET' | 'DELHIVERY';
  courierCode: CourierCode;
  courierName: string;
  /** What the carrier charges the shop (INR). Informational for admins. */
  rate: number;
  codAvailable: boolean;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
  /** Provider-specific courier id used when creating the shipment. */
  providerCourierId?: string;
}

export interface ServiceabilityResult {
  pincode: string;
  serviceable: boolean;
  codAvailable: boolean;
  /** What the customer is charged for delivery (INR). */
  deliveryFee: number;
  /** Extra fee charged when cash is collected on delivery (INR). */
  codFee: number;
  freeDeliveryOver: number;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
  source: 'provider' | 'estimate';
  options: CourierQuote[];
  message?: string;
  checkedAt: string;
}

export interface ShippingSettings {
  originPincode: string;
  originCity: string;
  originState: string;
  pickupLocationName: string;
  contactName: string;
  contactPhone: string;
  addressLine1: string;
  addressLine2: string;
  baseDeliveryFee: number;
  freeDeliveryOver: number;
  codEnabled: boolean;
  codFee: number;
  /** Empty = every valid Indian pincode is serviceable. */
  serviceablePincodes: string[];
  noCodPincodes: string[];
  localDaysMin: number;
  localDaysMax: number;
  regionalDaysMin: number;
  regionalDaysMax: number;
  nationalDaysMin: number;
  nationalDaysMax: number;
}

export const DEFAULT_SHIPPING_SETTINGS: ShippingSettings = {
  originPincode: '751001',
  originCity: 'Bhubaneswar',
  originState: 'Odisha',
  pickupLocationName: 'Primary Warehouse',
  contactName: 'Ramachandra Traders',
  contactPhone: '9938649590',
  addressLine1: '',
  addressLine2: '',
  baseDeliveryFee: 49,
  freeDeliveryOver: 5000,
  codEnabled: true,
  codFee: 0,
  serviceablePincodes: [],
  noCodPincodes: [],
  localDaysMin: 1,
  localDaysMax: 2,
  regionalDaysMin: 2,
  regionalDaysMax: 4,
  nationalDaysMin: 4,
  nationalDaysMax: 7,
};

/**
 * Offline delivery estimate used when no carrier credentials are configured.
 * Indian pincode zones: first digit 1-2 = North, 3-4 = West, 5-6 = South,
 * 7 = East, 8 = East/NE. Same state prefix gets local service.
 */
export function estimateDelivery(
  originPincode: string,
  destinationPincode: string,
  settings: Pick<
    ShippingSettings,
    'localDaysMin' | 'localDaysMax' | 'regionalDaysMin' | 'regionalDaysMax' | 'nationalDaysMin' | 'nationalDaysMax'
  > = DEFAULT_SHIPPING_SETTINGS
): { min: number; max: number; zone: 'local' | 'regional' | 'national' } {
  const origin = originPincode.slice(0, 3);
  const dest = destinationPincode.slice(0, 3);
  if (origin === dest) return { min: settings.localDaysMin, max: settings.localDaysMax, zone: 'local' };

  const regionOf = (p: string) => {
    const d = Number(p[0]);
    if (d <= 2) return 'north';
    if (d <= 4) return 'west';
    if (d <= 6) return 'south';
    if (d === 7) return 'east';
    return 'northeast';
  };

  if (regionOf(originPincode) === regionOf(destinationPincode)) {
    return { min: settings.regionalDaysMin, max: settings.regionalDaysMax, zone: 'regional' };
  }
  return { min: settings.nationalDaysMin, max: settings.nationalDaysMax, zone: 'national' };
}

/** Billing weight for a cart: actual weight with a 0.5 kg per-line floor. */
export function shipmentWeightKg(items: Array<{ weight?: number; quantity: number }>): number {
  const grams = items.reduce((sum, it) => sum + Math.max(0.1, Number(it.weight) || 0.5) * Math.max(1, it.quantity), 0);
  return Math.max(0.5, Math.ceil(grams * 2) / 2);
}
