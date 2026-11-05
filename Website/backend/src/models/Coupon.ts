import { Schema, model, type InferSchemaType } from 'mongoose';

const couponSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    description: { type: String, default: '', maxlength: 1000 },
    type: { type: String, enum: ['PERCENT', 'FLAT'], required: true, default: 'PERCENT' },
    value: { type: Number, required: true, min: 0 },
    minOrder: { type: Number, default: 0, min: 0 },
    // For PERCENT coupons: cap on the discount amount. 0 = no cap.
    maxDiscount: { type: Number, default: 0, min: 0 },
    minProductPrice: { type: Number, default: 0, min: 0 },
    minItems: { type: Number, default: 0, min: 0 },
    scope: { type: String, enum: ['ALL', 'CATEGORIES', 'PRODUCTS'], default: 'ALL' },
    categories: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
    products: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
    usageLimit: { type: Number, default: 0, min: 0 },
    perUserLimit: { type: Number, default: 0, min: 0 },
    totalUses: { type: Number, default: 0, min: 0 },
    totalDiscount: { type: Number, default: 0, min: 0 },
    startsAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

couponSchema.index({ isActive: 1, expiresAt: 1, startsAt: 1, createdAt: -1, _id: -1 });
couponSchema.index({ createdAt: -1, _id: -1 });

export type CouponDoc = InferSchemaType<typeof couponSchema>;

export const CouponModel = model('Coupon', couponSchema);
