import { Schema, model, type InferSchemaType } from 'mongoose';

const shipmentEventSchema = new Schema(
  {
    status: { type: String, required: true },
    rawStatus: { type: String, default: '' },
    at: { type: Date, required: true, default: Date.now },
    note: { type: String, default: '' },
    location: { type: String, default: '' },
  },
  { _id: false }
);

/**
 * One carrier shipment per order. The provider payload is retained for
 * reconciliation, but only whitelisted fields are ever sent to customers.
 */
const shipmentSchema = new Schema(
  {
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true, unique: true, index: true },
    provider: { type: String, enum: ['SHIPROCKET', 'DELHIVERY', 'MANUAL'], required: true },
    providerOrderId: { type: String, default: '' },
    providerShipmentId: { type: String, default: '' },
    status: {
      type: String,
      enum: [
        'PENDING', 'CREATED', 'PICKUP_SCHEDULED', 'PICKED_UP', 'IN_TRANSIT',
        'OUT_FOR_DELIVERY', 'DELIVERED', 'RTO_IN_TRANSIT', 'RTO_DELIVERED',
        'EXCEPTION', 'CANCELLED',
      ],
      default: 'PENDING',
      index: true,
    },
    courierCode: { type: String, default: null },
    courierName: { type: String, default: '' },
    awb: { type: String, default: '', index: true },
    trackingUrl: { type: String, default: '' },
    labelUrl: { type: String, default: '' },
    manifestUrl: { type: String, default: '' },
    weight: { type: Number, default: 0.5, min: 0 },
    length: { type: Number, default: 20, min: 0 },
    breadth: { type: Number, default: 15, min: 0 },
    height: { type: Number, default: 10, min: 0 },
    codAmount: { type: Number, default: 0, min: 0 },
    charge: { type: Number, default: 0, min: 0 },
    pickupScheduledAt: { type: Date, default: null },
    estimatedDeliveryDate: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    events: { type: [shipmentEventSchema], default: [] },
    warnings: { type: [String], default: [] },
    lastSyncedAt: { type: Date, default: null },
    /** Raw provider responses for support/debugging. Admin-only. */
    payload: { type: Schema.Types.Mixed, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

shipmentSchema.index({ createdAt: -1, _id: -1 });
shipmentSchema.index({ provider: 1, providerShipmentId: 1 });

export type ShipmentDoc = InferSchemaType<typeof shipmentSchema>;
export const ShipmentModel = model('Shipment', shipmentSchema);
