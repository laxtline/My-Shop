export const DELIVERY_FEE = 49;
export const FREE_DELIVERY_OVER = 5000;
export const MAX_CART_LINES = 200;

/**
 * Delivery pricing configuration.
 * In production, these should come from a database/config for per-pincode rates.
 */
export interface DeliveryConfig {
  baseFee: number;
  freeOver: number;
  /** PIN codes where COD is not available */
  noCodPincodes?: string[];
  /** Serviceable PIN codes (empty = all) */
  serviceablePincodes?: string[];
  /** Per-pincode overrides (base fee) */
  pincodeRates?: Record<string, number>;
}

export const defaultDeliveryConfig: DeliveryConfig = {
  baseFee: DELIVERY_FEE,
  freeOver: FREE_DELIVERY_OVER,
};

/**
 * Calculate delivery fee for a given cart total and pincode.
 * Returns { fee, isFree, codAvailable, serviceable }.
 */
export function calculateDeliveryFee(
  itemsTotal: number,
  pincode: string,
  config: DeliveryConfig = defaultDeliveryConfig
): { fee: number; isFree: boolean; codAvailable: boolean; serviceable: boolean } {
  // Check serviceability
  if (config.serviceablePincodes && config.serviceablePincodes.length > 0) {
    const serviceable = config.serviceablePincodes.some((p) => pincode.startsWith(p.slice(0, 3)));
    if (!serviceable) {
      return { fee: 0, isFree: false, codAvailable: false, serviceable: false };
    }
  }

  // Check COD availability
  const codAvailable = !config.noCodPincodes?.some((p) => pincode.startsWith(p.slice(0, 3)));

  // Check per-pincode rate
  let fee = config.baseFee;
  if (config.pincodeRates) {
    for (const [prefix, rate] of Object.entries(config.pincodeRates)) {
      if (pincode.startsWith(prefix)) {
        fee = rate;
        break;
      }
    }
  }

  const isFree = itemsTotal >= config.freeOver;
  return { fee: isFree ? 0 : fee, isFree, codAvailable, serviceable: true };
}

export function unitPriceForQty(product: { price: number; bulkPricing?: { minQty: number; pricePerUnit: number }[] }, quantity: number) {
  return (product.bulkPricing ?? []).reduce((price, tier) =>
    quantity >= tier.minQty ? Math.min(price, tier.pricePerUnit) : price, product.price);
}
export const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
