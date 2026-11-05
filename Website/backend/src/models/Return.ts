import { Schema, model, type InferSchemaType } from 'mongoose';

const shippingAddressSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    line1: { type: String, required: true, trim: true },
    line2: { type: String, default: '', trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const returnStatusHistorySchema = new Schema(
  {
    status: { type: String, required: true },
    timestamp: { type: Date, required: true, default: Date.now },
    note: { type: String, default: '' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { _id: false }
);

const returnSchema = new Schema(
  {
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    items: [{
      product: { type: Schema.Types.ObjectId, ref: 'Product' },
      title: { type: String, required: true },
      quantity: { type: Number, required: true, min: 1 },
      unitPrice: { type: Number, required: true, min: 0 },
      lineTotal: { type: Number, required: true, min: 0 },
    }],
    reason: { type: String, required: true, trim: true },
    pickupAddress: { type: shippingAddressSchema, required: true },
    status: {
      type: String,
      enum: ['REQUESTED', 'APPROVED', 'PICKUP_SCHEDULED', 'PICKED_UP', 'RECEIVED', 'REFUND_INITIATED', 'REFUNDED', 'REJECTED'],
      required: true,
      default: 'REQUESTED',
      index: true,
    },
    courierName: { type: String, default: '' },
    trackingId: { type: String, default: '' },
    trackingUrl: { type: String, default: '' },
    statusHistory: { type: [returnStatusHistorySchema], default: [] },
    adminNotes: { type: String, default: '' },
    refundAmount: { type: Number, default: 0, min: 0 },
    refund: { type: Schema.Types.ObjectId, ref: 'Refund', default: null },
  },
  { timestamps: true }
);

returnSchema.index({ createdAt: -1, _id: -1 });
returnSchema.index({ user: 1, createdAt: -1, _id: -1 });
returnSchema.index({ status: 1, createdAt: -1, _id: -1 });

export type ReturnDoc = InferSchemaType<typeof returnSchema>;

export const ReturnModel = model('Return', returnSchema);