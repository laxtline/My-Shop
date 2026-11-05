import type { Product, Category, BulkPriceTier } from '@shared/types';
import { imageUrl } from '@shared/images';

// Format a number as Indian Rupees, e.g. 1480 -> "₹1,480".
export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);
}

// Discount percentage from mrp/price (rounded, never negative).
export function discountPercent(price: number, mrp: number): number {
  if (!mrp || mrp <= 0 || price >= mrp) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}

/**
 * Effective per-unit price for a given quantity, honouring bulk-pricing tiers.
 * Picks the cheapest tier whose minQty is satisfied; falls back to base price.
 */
export function unitPriceForQty(product: Pick<Product, 'price' | 'bulkPricing'>, qty: number): number {
  let best = product.price;
  for (const tier of product.bulkPricing ?? []) {
    if (qty >= tier.minQty && tier.pricePerUnit < best) best = tier.pricePerUnit;
  }
  return best;
}

// The next bulk tier a buyer could unlock above the current quantity, if any.
export function nextBulkTier(
  tiers: BulkPriceTier[] | undefined,
  qty: number
): BulkPriceTier | null {
  if (!tiers?.length) return null;
  const upcoming = tiers
    .filter((t) => t.minQty > qty)
    .sort((a, b) => a.minQty - b.minQty);
  return upcoming[0] ?? null;
}

// Resolve a product's primary image, with a safe placeholder fallback.
export function primaryImage(product: Pick<Product, 'images' | 'title'>): string {
  return imageUrl(product.images?.[0] || PLACEHOLDER_IMAGE, 480);
}

// Category may be populated or just an id string — get a display name safely.
export function categoryName(category: Category | string | undefined): string | null {
  if (!category || typeof category === 'string') return null;
  return category.name;
}

export function categorySlug(category: Category | string | undefined): string | null {
  if (!category || typeof category === 'string') return null;
  return category.slug;
}

// A neutral inline SVG placeholder (no network request) for missing images.
export const PLACEHOLDER_IMAGE =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="700"><rect width="100%" height="100%" fill="#f1f5f9"/><text x="50%" y="50%" font-family="sans-serif" font-size="28" fill="#94a3b8" text-anchor="middle" dominant-baseline="middle">No image</text></svg>`
  );
