export const DELIVERY_FEE = 49;
export const FREE_DELIVERY_OVER = 5000;
export const MAX_CART_LINES = 200;
export function unitPriceForQty(product: { price: number; bulkPricing?: { minQty: number; pricePerUnit: number }[] }, quantity: number) {
  return (product.bulkPricing ?? []).reduce((price, tier) =>
    quantity >= tier.minQty ? Math.min(price, tier.pricePerUnit) : price, product.price);
}
export const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
