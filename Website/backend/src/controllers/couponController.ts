import type { Request, Response } from "express";
import { CouponModel } from "../models/Coupon.js";
import { ApiError } from "../utils/ApiError.js";

interface CouponCalc {
  type: string;
  value: number;
  maxDiscount: number;
}

/** Compute the discount amount a coupon yields for a given items total. */
export function computeDiscount(coupon: CouponCalc, itemsTotal: number): number {
  if (coupon.type === "PERCENT") {
    let d = (itemsTotal * coupon.value) / 100;
    if (coupon.maxDiscount && coupon.maxDiscount > 0) d = Math.min(d, coupon.maxDiscount);
    return Math.round(d);
  }
  // FLAT — never more than the order itself.
  return Math.round(Math.min(coupon.value, itemsTotal));
}

/** Load a usable coupon for a given items total, or throw ApiError(400). */
export async function resolveCoupon(code: string, itemsTotal: number) {
  const coupon = await CouponModel.findOne({ code: code.toUpperCase().trim() });
  if (!coupon || !coupon.isActive) throw new ApiError(400, "Invalid or inactive coupon code.");
  if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) {
    throw new ApiError(400, "This coupon has expired.");
  }
  if (itemsTotal < coupon.minOrder) {
    throw new ApiError(400, `This coupon needs a minimum order of ₹${coupon.minOrder}.`);
  }
  return { coupon, discount: computeDiscount(coupon, itemsTotal) };
}

/** POST /api/coupons/validate — auth. Body: { code, itemsTotal }. */
export async function validateCoupon(req: Request, res: Response) {
  const code = String(req.body?.code ?? "");
  const itemsTotal = Number(req.body?.itemsTotal);
  if (!code.trim()) throw new ApiError(400, "Coupon code is required.");
  if (!Number.isFinite(itemsTotal) || itemsTotal <= 0) throw new ApiError(400, "Invalid cart total.");

  const { coupon, discount } = await resolveCoupon(code, itemsTotal);
  res.json({
    success: true,
    data: { code: coupon.code, type: coupon.type, value: coupon.value, discount },
    message: "Coupon applied.",
  });
}

// --- Admin ------------------------------------------------------------------

/** GET /api/coupons — admin. All coupons, newest first. */
export async function listCoupons(_req: Request, res: Response) {
  const coupons = await CouponModel.find().sort({ createdAt: -1 });
  res.json({ success: true, data: coupons });
}

/** POST /api/coupons — admin. */
export async function createCoupon(req: Request, res: Response) {
  const { code, type, value, minOrder, maxDiscount, isActive, expiresAt } = req.body ?? {};
  const norm = String(code ?? "").toUpperCase().trim();
  if (!norm) throw new ApiError(400, "Coupon code is required.");
  if (await CouponModel.exists({ code: norm })) {
    throw new ApiError(409, "A coupon with this code already exists.");
  }

  const couponType = type === "FLAT" ? "FLAT" : "PERCENT";
  const rawValue = Number(value) || 0;
  if (rawValue <= 0) throw new ApiError(400, "Coupon value must be greater than 0.");
  // A percent coupon can never exceed 100%.
  const normValue = couponType === "PERCENT" ? Math.min(rawValue, 100) : rawValue;

  const coupon = await CouponModel.create({
    code: norm,
    type: couponType,
    value: normValue,
    minOrder: Math.max(0, Number(minOrder) || 0),
    maxDiscount: Math.max(0, Number(maxDiscount) || 0),
    isActive: isActive !== false,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
  });
  res.status(201).json({ success: true, data: coupon, message: "Coupon created." });
}

/** DELETE /api/coupons/:id — admin. */
export async function deleteCoupon(req: Request, res: Response) {
  const deleted = await CouponModel.findByIdAndDelete(req.params.id);
  if (!deleted) throw new ApiError(404, "Coupon not found.");
  res.json({ success: true, message: "Coupon deleted." });
}
