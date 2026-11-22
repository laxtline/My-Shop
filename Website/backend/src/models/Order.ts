import { Schema, model, type InferSchemaType } from 'mongoose';

const orderItemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product' },
    title: { type: String, required: true },
    image: { type: String, default: '' },
    sku: { type: String, default: '' },
    unitPrice: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

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

const statusHistorySchema = new Schema(
  {
    status: { type: String, required: true },
    timestamp: { type: Date, required: true, default: Date.now },
    note: { type: String, default: '' },
  },
  { _id: false }
);

const courierInfoSchema = new Schema(
  {
    name: { type: String, default: '' },
    trackingId: { type: String, default: '' },
    trackingUrl: { type: String, default: '' },
  },
  { _id: false }
);

const returnRequestSchema = new Schema(
  {
    requestedAt: { type: Date },
    reason: { type: String, default: '' },
    pickupAddress: { type: shippingAddressSchema, default: null },
    status: {
      type: String,
      enum: ['REQUESTED', 'APPROVED', 'PICKUP_SCHEDULED', 'PICKED_UP', 'RECEIVED', 'REFUND_INITIATED', 'REFUNDED', 'REJECTED'],
      default: null,
    },
    adminNotes: { type: String, default: '' },
  },
  { _id: false }
);

const refundSchema = new Schema(
  {
    method: { type: String, enum: ['RAZORPAY', 'UPI', 'BANK'], default: null },
    // Encrypted fields - stored as base64 encrypted strings
    upiIdEncrypted: { type: String, default: '' },
    bankAccountEncrypted: { type: String, default: '' },
    bankIfscEncrypted: { type: String, default: '' },
    bankNameEncrypted: { type: String, default: '' },
    accountHolderNameEncrypted: { type: String, default: '' },
    amount: { type: Number, default: 0 },
    status: { type: String, enum: ['PENDING', 'COMPLETED', 'FAILED'], default: 'PENDING' },
    razorpayRefundId: { type: String, default: '' },
    refund: { type: Schema.Types.ObjectId, ref: 'Refund', default: null },
    processedAt: { type: Date, default: null },
    processedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { _id: false }
);

const orderSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    items: { type: [orderItemSchema], required: true },
    shippingAddress: { type: shippingAddressSchema, required: true },
    paymentMethod: { type: String, enum: ['COD', 'RAZORPAY'], required: true, default: 'COD' },
    paymentStatus: { type: String, enum: ['PENDING', 'PAID', 'FAILED'], required: true, default: 'PENDING' },
    /** Instrument behind the payment (UPI, card, netbanking, wallet or COD). */
    paymentChannel: {
      type: String,
      enum: ['COD', 'UPI', 'CARD', 'NETBANKING', 'WALLET', 'UNKNOWN'],
      default: 'UNKNOWN',
    },
    // Razorpay references (set only for online payments).
    razorpayOrderId: { type: String, default: '' },
    razorpayPaymentId: { type: String, default: '' },
    razorpayPaymentLinkId: { type: String, default: '' },
    paidAt: { type: Date, default: null },
    /** Set when cash is physically collected for a COD order. */
    codCollectedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ['PLACED', 'CONFIRMED', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
      required: true,
      default: 'PLACED',
      index: true,
    },
    itemsTotal: { type: Number, required: true, min: 0 },
    deliveryFee: { type: Number, required: true, min: 0, default: 0 },
    couponCode: { type: String, default: '' },
    coupon: { type: Schema.Types.ObjectId, ref: 'Coupon', default: null },
    couponSnapshot: { type: Schema.Types.Mixed, default: null },
    discount: { type: Number, required: true, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0 },
    notes: { type: String, default: '' },
    // New fields for tracking & returns
    courierInfo: { type: courierInfoSchema, default: {} },
    shipment: { type: Schema.Types.ObjectId, ref: 'Shipment', default: null },
    expectedDeliveryDate: { type: Date, default: null },
    statusHistory: { type: [statusHistorySchema], default: [] },
    returnRequest: { type: returnRequestSchema, default: {} },
    refund: { type: refundSchema, default: {} },
  },
  { timestamps: true }
);

orderSchema.index({ createdAt: -1, _id: -1 });
orderSchema.index({ user: 1, createdAt: -1, _id: -1 });
orderSchema.index({ status: 1, createdAt: -1, _id: -1 });
orderSchema.index({ couponCode: 1, createdAt: -1 });
orderSchema.index({ paymentStatus: 1, createdAt: -1 });
orderSchema.index({ 'courierInfo.trackingId': 1 });
orderSchema.index({ paymentChannel: 1, createdAt: -1 });
orderSchema.index({ codCollectedAt: 1 });

export type OrderDoc = InferSchemaType<typeof orderSchema>;

export const OrderModel = model('Order', orderSchema);
