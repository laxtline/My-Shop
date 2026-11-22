import { Schema, model, type InferSchemaType } from 'mongoose';

const refundSchema = new Schema(
  {
    // Null for cancellation refunds, where no physical return exists.
    return: { type: Schema.Types.ObjectId, ref: 'Return', default: null, index: true },
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    kind: { type: String, enum: ['RETURN', 'CANCELLATION'], default: 'RETURN', index: true },
    reason: { type: String, default: '' },
    amount: { type: Number, required: true, min: 0 },
    /**
     * RAZORPAY = automated gateway refund to the original instrument.
     * UPI/BANK = manual payout to customer-supplied details (encrypted below).
     */
    method: { type: String, enum: ['RAZORPAY', 'UPI', 'BANK'], required: true },
    razorpayRefundId: { type: String, default: '' },
    razorpayPaymentId: { type: String, default: '' },
    failureReason: { type: String, default: '' },
    // Encrypted fields - stored as base64 encrypted strings
    upiIdEncrypted: { type: String, default: '' },
    bankAccountEncrypted: { type: String, default: '' },
    bankIfscEncrypted: { type: String, default: '' },
    bankNameEncrypted: { type: String, default: '' },
    accountHolderNameEncrypted: { type: String, default: '' },
    status: {
      type: String,
      enum: ['PENDING', 'COMPLETED', 'FAILED'],
      required: true,
      default: 'PENDING',
      index: true,
    },
    processedAt: { type: Date, default: null },
    processedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    adminNotes: { type: String, default: '' },
  },
  { timestamps: true }
);

refundSchema.index({ createdAt: -1, _id: -1 });
refundSchema.index({ user: 1, createdAt: -1, _id: -1 });
refundSchema.index({ status: 1, createdAt: -1, _id: -1 });

export type RefundDoc = InferSchemaType<typeof refundSchema>;

export const RefundModel = model('Refund', refundSchema);