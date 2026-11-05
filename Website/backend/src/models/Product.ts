import { Schema, model, type InferSchemaType } from 'mongoose';
import { slugify } from '../utils/slugify.js';

const bulkPricingSchema = new Schema(
  {
    minQty: { type: Number, required: true, min: 1 },
    pricePerUnit: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const productSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true },
    description: { type: String, default: '' },
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    brand: { type: String, default: '', trim: true },
    images: { type: [String], default: [] },
    price: { type: Number, required: true, min: 0, index: true },
    mrp: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0, max: 100 },
    stock: { type: Number, default: 0, min: 0 },
    sku: { type: String, required: true, unique: true },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    numReviews: { type: Number, default: 0, min: 0 },
    specifications: { type: Map, of: String, default: {} },
    tags: { type: [String], default: [], index: true },
    isActive: { type: Boolean, default: true, index: true },
    bulkPricing: { type: [bulkPricingSchema], default: [] },
    gstRate: { type: Number, default: 18, min: 0 },
    weight: { type: Number, default: 0, min: 0 }, // kg
  },
  { timestamps: true }
);

// Full-text search across title/description/tags/brand.
productSchema.index({ title: 'text', description: 'text', tags: 'text', brand: 'text' });
productSchema.index({ title: 1, _id: 1 });
productSchema.index({ createdAt: -1, _id: -1 });
for (const field of ['createdAt', 'price', 'rating', 'discount'] as const) {
  const direction = field === 'price' ? 1 : -1;
  productSchema.index({ isActive: 1, [field]: direction, _id: direction });
  productSchema.index({ isActive: 1, category: 1, [field]: direction, _id: direction });
}
productSchema.index({ isActive: 1, brand: 1, createdAt: -1, _id: -1 });

// Auto slug + auto discount % from mrp/price.
productSchema.pre('validate', function (next) {
  if (!this.slug && this.title) this.slug = slugify(this.title);
  if (this.mrp && this.price && this.mrp > 0) {
    const computed = Math.round(((this.mrp - this.price) / this.mrp) * 100);
    this.discount = Math.max(0, computed);
  }
  next();
});

export type ProductDoc = InferSchemaType<typeof productSchema>;

export const ProductModel = model('Product', productSchema);
