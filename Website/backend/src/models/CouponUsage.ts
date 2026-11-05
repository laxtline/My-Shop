import { Schema, model } from 'mongoose';

const schema = new Schema({
  coupon: { type: Schema.Types.ObjectId, ref: 'Coupon', required: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  order: { type: Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
  couponCode: { type: String, required: true },
  customerName: { type: String, required: true },
  customerEmail: { type: String, required: true },
  discount: { type: Number, required: true, min: 0 },
  orderTotal: { type: Number, required: true, min: 0, default: 0 },
}, { timestamps: true });
schema.index({ coupon: 1, user: 1 });
schema.index({ coupon: 1, createdAt: -1, _id: -1 });
export const CouponUsageModel = model('CouponUsage', schema);
