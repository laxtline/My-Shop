import { Schema, model, type InferSchemaType } from 'mongoose';
import { DEFAULT_SHIPPING_SETTINGS } from '@shared/shipping.js';

/**
 * Shop-wide shipping configuration. A single document (`key: "default"`) is
 * edited from the admin panel and read by checkout, shipment creation and the
 * offline serviceability estimator.
 */
const shippingSettingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: 'default' },
    originPincode: { type: String, default: DEFAULT_SHIPPING_SETTINGS.originPincode, trim: true },
    originCity: { type: String, default: DEFAULT_SHIPPING_SETTINGS.originCity, trim: true },
    originState: { type: String, default: DEFAULT_SHIPPING_SETTINGS.originState, trim: true },
    pickupLocationName: { type: String, default: DEFAULT_SHIPPING_SETTINGS.pickupLocationName, trim: true },
    contactName: { type: String, default: DEFAULT_SHIPPING_SETTINGS.contactName, trim: true },
    contactPhone: { type: String, default: DEFAULT_SHIPPING_SETTINGS.contactPhone, trim: true },
    addressLine1: { type: String, default: '', trim: true },
    addressLine2: { type: String, default: '', trim: true },
    baseDeliveryFee: { type: Number, default: DEFAULT_SHIPPING_SETTINGS.baseDeliveryFee, min: 0 },
    freeDeliveryOver: { type: Number, default: DEFAULT_SHIPPING_SETTINGS.freeDeliveryOver, min: 0 },
    codEnabled: { type: Boolean, default: DEFAULT_SHIPPING_SETTINGS.codEnabled },
    codFee: { type: Number, default: DEFAULT_SHIPPING_SETTINGS.codFee, min: 0 },
    /** Empty = all valid pincodes are serviceable. Prefixes (e.g. "751") are allowed. */
    serviceablePincodes: { type: [String], default: [] },
    noCodPincodes: { type: [String], default: [] },
    localDaysMin: { type: Number, default: DEFAULT_SHIPPING_SETTINGS.localDaysMin, min: 0 },
    localDaysMax: { type: Number, default: DEFAULT_SHIPPING_SETTINGS.localDaysMax, min: 0 },
    regionalDaysMin: { type: Number, default: DEFAULT_SHIPPING_SETTINGS.regionalDaysMin, min: 0 },
    regionalDaysMax: { type: Number, default: DEFAULT_SHIPPING_SETTINGS.regionalDaysMax, min: 0 },
    nationalDaysMin: { type: Number, default: DEFAULT_SHIPPING_SETTINGS.nationalDaysMin, min: 0 },
    nationalDaysMax: { type: Number, default: DEFAULT_SHIPPING_SETTINGS.nationalDaysMax, min: 0 },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

export type ShippingSettingsDoc = InferSchemaType<typeof shippingSettingsSchema>;
export const ShippingSettingsModel = model('ShippingSettings', shippingSettingsSchema);
