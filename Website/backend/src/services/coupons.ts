import type { ClientSession } from 'mongoose';
import { CouponModel } from '../models/Coupon.js';
import { CouponUsageModel } from '../models/CouponUsage.js';
import { CategoryModel } from '../models/Category.js';
import { ApiError } from '../utils/ApiError.js';
import { money } from '@shared/pricing.js';
import type { PricedCart } from './cartPricing.js';

const rupees = (n: number) => `₹${money(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export function computeDiscount(coupon: { type: string; value: number; maxDiscount: number }, eligibleTotal: number) {
  let discount = coupon.type === 'PERCENT' ? eligibleTotal * coupon.value / 100 : coupon.value;
  if (coupon.type === 'PERCENT' && coupon.maxDiscount > 0) discount = Math.min(discount, coupon.maxDiscount);
  return money(Math.max(0, Math.min(eligibleTotal, discount)));
}

export async function resolveCoupon(code: string, userId: string, cart: PricedCart, session?: ClientSession) {
  const coupon = await CouponModel.findOne({ code: code.toUpperCase().trim() }).session(session ?? null);
  if (!coupon) throw new ApiError(400, 'Invalid coupon code.');
  if (!coupon.isActive) throw new ApiError(400, 'This coupon is disabled.');
  const now = Date.now();
  if (coupon.expiresAt && coupon.expiresAt.getTime() <= now) throw new ApiError(400, 'Coupon expired.');
  if (coupon.startsAt && coupon.startsAt.getTime() > now) throw new ApiError(400, `Coupon starts on ${coupon.startsAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST.`);
  if (coupon.usageLimit > 0 && coupon.totalUses >= coupon.usageLimit) throw new ApiError(400, 'Usage limit reached.');
  if (coupon.perUserLimit > 0) {
    const used = await CouponUsageModel.countDocuments({ coupon: coupon._id, user: userId }).session(session ?? null);
    if (used >= coupon.perUserLimit) throw new ApiError(400, 'Already used by you: your usage limit has been reached.');
  }
  if (cart.itemsTotal < coupon.minOrder) throw new ApiError(400, `Add items worth ${rupees(coupon.minOrder - cart.itemsTotal)} more.`);

  const categories = new Set(coupon.categories.map(String));
  const products = new Set(coupon.products.map(String));
  let eligible = cart.items.filter((line) => coupon.scope === 'CATEGORIES' ? categories.has(String(line.category))
    : coupon.scope === 'PRODUCTS' ? products.has(String(line.product)) : true);
  if (!eligible.length) {
    if (coupon.scope === 'CATEGORIES') {
      const names = await CategoryModel.find({ _id: { $in: coupon.categories } }).select('name').limit(3).session(session ?? null);
      throw new ApiError(400, `Valid only on ${names.map((c) => c.name).join(', ') || 'the selected categories'}.`);
    }
    throw new ApiError(400, 'Valid only on the selected products.');
  }
  eligible = eligible.filter((line) => line.unitPrice >= coupon.minProductPrice);
  if (!eligible.length) throw new ApiError(400, `Add an eligible product priced at least ${rupees(coupon.minProductPrice)} per unit.`);
  const units = eligible.reduce((sum, line) => sum + line.quantity, 0);
  if (units < coupon.minItems) throw new ApiError(400, `Add ${coupon.minItems - units} more eligible item(s).`);
  const eligibleTotal = money(eligible.reduce((sum, line) => sum + line.lineTotal, 0));
  const discount = computeDiscount(coupon, eligibleTotal);
  return { coupon, discount, eligibleTotal };
}
