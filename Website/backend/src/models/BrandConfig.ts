import { Schema, model, type InferSchemaType } from 'mongoose';
import { DEFAULT_BRAND } from '@shared/constants/index.js';

// Single-document collection holding live, admin-editable branding.
// Never hardcode these values in any client — fetch from GET /api/brand.
const brandConfigSchema = new Schema(
  {
    appName: { type: String, required: true, default: DEFAULT_BRAND.appName },
    tagline: { type: String, required: true, default: DEFAULT_BRAND.tagline },
    logoUrl: { type: String, required: true, default: DEFAULT_BRAND.logoUrl },
    supportPhone: { type: String, required: true, default: DEFAULT_BRAND.supportPhone },
    supportEmail: { type: String, required: true, default: DEFAULT_BRAND.supportEmail },
    themeColor: { type: String, required: true, default: DEFAULT_BRAND.themeColor },
  },
  { timestamps: true }
);

export type BrandConfigDoc = InferSchemaType<typeof brandConfigSchema>;

export const BrandConfigModel = model('BrandConfig', brandConfigSchema);

// Returns the singleton brand document, creating it from defaults if absent.
export async function getOrCreateBrand() {
  const existing = await BrandConfigModel.findOne();
  if (existing) return existing;
  return BrandConfigModel.create({ ...DEFAULT_BRAND });
}
