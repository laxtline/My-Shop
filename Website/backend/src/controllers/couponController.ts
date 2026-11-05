import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { CouponModel } from '../models/Coupon.js';
import { CouponUsageModel } from '../models/CouponUsage.js';
import { CategoryModel } from '../models/Category.js';
import { ProductModel } from '../models/Product.js';
import { priceCart } from '../services/cartPricing.js';
import { resolveCoupon } from '../services/coupons.js';
import { ApiError } from '../utils/ApiError.js';
import { cursorFilter, cursorPage, getPageParams } from '../utils/pagination.js';
import { money } from '@shared/pricing.js';
export { computeDiscount } from '../services/coupons.js';

const sort = { field: 'createdAt', direction: -1, kind: 'date' } as const;

export async function validateCoupon(req: Request, res: Response) {
  const cart = await priceCart(String(req.user!._id));
  const { coupon, discount, eligibleTotal } = await resolveCoupon(String(req.body.code), String(req.user!._id), cart);
  res.json({ success: true, data: { code: coupon.code, type: coupon.type, value: coupon.value,
    discount, eligibleTotal, itemsTotal: cart.itemsTotal, deliveryFee: cart.deliveryFee,
    total: money(cart.itemsTotal + cart.deliveryFee - discount) }, message: 'Coupon applied.' });
}

export async function listCoupons(req: Request, res: Response) {
  const { page, limit, skip } = getPageParams(req, 20, 100);
  const now = new Date();
  const conditions = {
    inactive: { isActive: false },
    expired: { isActive: true, expiresAt: { $lte: now, $ne: null } },
    scheduled: { isActive: true, startsAt: { $gt: now }, $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
    active: { isActive: true, $and: [
      { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
      { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
    ] },
  };
  const view = String(req.query.view ?? 'active');
  if (!(view in conditions)) throw new ApiError(400, 'Unknown coupon view.');
  const filter: Record<string, unknown> = { ...conditions[view as keyof typeof conditions] };
  const q = String(req.query.q ?? '').trim().toUpperCase().slice(0, 40);
  if (q) filter.code = { $regex: `^${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` };
  // A cursor is bound to the view, not the moving current-time boundary.
  const scope = { view, q };
  const [rows, total, countRows, start, end] = await Promise.all([
    CouponModel.find({ $and: [filter, cursorFilter(req, sort, scope)] }).sort({ createdAt: -1, _id: -1 })
      .skip(req.query.cursor ? 0 : skip).limit(limit + 1),
    CouponModel.countDocuments(filter),
    CouponModel.aggregate([{ $group: { _id: { $switch: { branches: [
      { case: { $eq: ['$isActive', false] }, then: 'inactive' },
      { case: { $and: [{ $ne: [{ $ifNull: ['$expiresAt', null] }, null] }, { $lte: ['$expiresAt', now] }] }, then: 'expired' },
      { case: { $gt: ['$startsAt', now] }, then: 'scheduled' },
    ], default: 'active' } }, count: { $sum: 1 } } }]),
    CouponModel.findOne({ isActive: true, startsAt: { $gt: now } }).sort({ startsAt: 1 }).select('startsAt'),
    CouponModel.findOne({ isActive: true, expiresAt: { $gt: now } }).sort({ expiresAt: 1 }).select('expiresAt'),
  ]);
  const counts = { active: 0, inactive: 0, expired: 0, scheduled: 0 };
  for (const row of countRows) counts[row._id as keyof typeof counts] = row.count;
  const transitions = [start?.startsAt, end?.expiresAt].filter((d): d is Date => !!d);
  res.json({ success: true, data: { ...cursorPage(rows, total, page, limit, sort, scope), counts,
    nextTransitionAt: transitions.length ? new Date(Math.min(...transitions.map(Number))).toISOString() : null } });
}

function date(value: unknown, label: string) {
  if (value == null || value === '') return null;
  const result = new Date(String(value));
  if (!Number.isFinite(result.getTime())) throw new ApiError(400, `${label} must be a valid date and time.`);
  return result;
}

async function couponPayload(body: Record<string, unknown>) {
  const code = String(body.code ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9_-]{1,40}$/.test(code)) throw new ApiError(400, 'Code must contain only letters, numbers, underscores or hyphens.');
  const type = body.type ?? 'PERCENT';
  if (!['PERCENT', 'FLAT'].includes(String(type))) throw new ApiError(400, 'Invalid discount type.');
  const number = (key: string, integer = false) => {
    const n = Number(body[key] ?? 0);
    if (!Number.isFinite(n) || n < 0 || integer && !Number.isSafeInteger(n)) throw new ApiError(400, `${key} must be a non-negative ${integer ? 'whole number' : 'number'}.`);
    return n;
  };
  const value = number('value');
  if (value <= 0 || type === 'PERCENT' && value > 100) throw new ApiError(400, 'Discount must be positive; a percentage cannot exceed 100.');
  const scope = String(body.scope ?? 'ALL');
  if (!['ALL', 'CATEGORIES', 'PRODUCTS'].includes(scope)) throw new ApiError(400, 'Invalid coupon scope.');
  const ids = (key: string) => {
    const values = body[key] ?? [];
    if (!Array.isArray(values) || values.length > 200 || values.some((v) => typeof v !== 'string' || !Types.ObjectId.isValid(v))) {
      throw new ApiError(400, `${key} must contain up to 200 valid IDs.`);
    }
    return [...new Set(values as string[])];
  };
  const categories = scope === 'CATEGORIES' ? ids('categories') : [];
  const products = scope === 'PRODUCTS' ? ids('products') : [];
  if (scope === 'CATEGORIES' && !categories.length || scope === 'PRODUCTS' && !products.length) throw new ApiError(400, 'Choose at least one item for the coupon scope.');
  if (categories.length && await CategoryModel.countDocuments({ _id: { $in: categories } }) !== categories.length ||
      products.length && await ProductModel.countDocuments({ _id: { $in: products } }) !== products.length) {
    throw new ApiError(400, 'Some selected categories or products no longer exist.');
  }
  const startsAt = date(body.startsAt, 'Start date'), expiresAt = date(body.expiresAt, 'Expiry date');
  if (startsAt && expiresAt && startsAt >= expiresAt) throw new ApiError(400, 'Expiry must be after the start date.');
  return { code, description: String(body.description ?? '').trim().slice(0, 1000), type, value,
    minOrder: number('minOrder'), minProductPrice: number('minProductPrice'), minItems: number('minItems', true),
    maxDiscount: type === 'PERCENT' ? number('maxDiscount') : 0, scope, categories, products,
    usageLimit: number('usageLimit', true), perUserLimit: number('perUserLimit', true),
    startsAt, expiresAt, isActive: body.isActive !== false };
}

export async function createCoupon(req: Request, res: Response) {
  const payload = await couponPayload(req.body);
  if (await CouponModel.exists({ code: payload.code })) throw new ApiError(409, 'A coupon with this code already exists.');
  const coupon = await CouponModel.create(payload);
  res.status(201).json({ success: true, data: coupon, message: 'Coupon created.' });
}

export async function updateCoupon(req: Request, res: Response) {
  const coupon = await CouponModel.findById(req.params.id);
  if (!coupon) throw new ApiError(404, 'Coupon not found.');
  const payload = await couponPayload({ ...coupon.toObject(), ...req.body });
  if (await CouponModel.exists({ code: payload.code, _id: { $ne: coupon._id } })) throw new ApiError(409, 'A coupon with this code already exists.');
  coupon.set(payload);
  await coupon.save();
  res.json({ success: true, data: coupon, message: 'Coupon updated.' });
}

export async function couponUsage(req: Request, res: Response) {
  const coupon = await CouponModel.findById(req.params.id).select('code totalUses totalDiscount');
  if (!coupon) throw new ApiError(404, 'Coupon not found.');
  const { page, limit, skip } = getPageParams(req, 20, 100);
  const scope = { coupon: String(coupon._id) };
  const rows = await CouponUsageModel.find({ $and: [{ coupon: coupon._id }, cursorFilter(req, sort, scope)] })
    .sort({ createdAt: -1, _id: -1 }).skip(req.query.cursor ? 0 : skip).limit(limit + 1);
  res.json({ success: true, data: { ...cursorPage(rows, coupon.totalUses, page, limit, sort, scope),
    totalDiscount: coupon.totalDiscount, code: coupon.code } });
}

export async function deleteCoupon(req: Request, res: Response) {
  const coupon = await CouponModel.findById(req.params.id);
  if (!coupon) throw new ApiError(404, 'Coupon not found.');
  // Preserve references and audit history, including for concurrent checkouts.
  coupon.isActive = false;
  await coupon.save();
  res.json({ success: true, message: 'Coupon disabled. Usage history is preserved.' });
}
