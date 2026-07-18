import { Schema, model, type InferSchemaType } from "mongoose";
import { slugify } from "../utils/slugify.js";

const categorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true },
    image: { type: String, default: "" },
    parentCategory: { type: Schema.Types.ObjectId, ref: "Category", default: null },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Auto-generate slug from name when missing.
categorySchema.pre("validate", function (next) {
  if (!this.slug && this.name) this.slug = slugify(this.name);
  next();
});

export type CategoryDoc = InferSchemaType<typeof categorySchema>;

export const CategoryModel = model("Category", categorySchema);
