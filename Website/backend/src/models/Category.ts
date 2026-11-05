import { Schema, model, type InferSchemaType } from 'mongoose';
import { slugify } from '../utils/slugify.js';

const categorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    nameSearch: { type: String, default: '' },
    slug: { type: String, required: true, unique: true, index: true },
    image: { type: String, default: '' },
    parentCategory: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);
categorySchema.index({ nameSearch: 1, _id: 1 });
categorySchema.index({ order: 1, _id: 1 });
categorySchema.index({ parentCategory: 1, nameSearch: 1, _id: 1 });
categorySchema.index({ createdAt: -1, _id: -1 });

// Auto-generate slug from name when missing.
categorySchema.pre('validate', function (next) {
  this.nameSearch = this.name.normalize('NFKC').toLowerCase();
  if (!this.slug && this.name) this.slug = slugify(this.name);
  next();
});

export type CategoryDoc = InferSchemaType<typeof categorySchema>;

export const CategoryModel = model('Category', categorySchema);
