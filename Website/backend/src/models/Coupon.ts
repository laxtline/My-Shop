import { Schema, model, type InferSchemaType } from "mongoose";

const couponSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    type: { type: String, enum: ["PERCENT", "FLAT"], required: true, default: "PERCENT" },
    value: { type: Number, required: true, min: 0 },
    minOrder: { type: Number, default: 0, min: 0 },
    // For PERCENT coupons: cap on the discount amount. 0 = no cap.
    maxDiscount: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export type CouponDoc = InferSchemaType<typeof couponSchema>;

export const CouponModel = model("Coupon", couponSchema);
