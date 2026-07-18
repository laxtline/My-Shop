import type { Request, Response } from "express";
import { CategoryModel } from "../models/Category.js";
import { ApiError } from "../utils/ApiError.js";
import { slugify } from "../utils/slugify.js";

/** GET /api/categories — public. All categories ordered by `order`. */
export async function listCategories(_req: Request, res: Response) {
  const categories = await CategoryModel.find().sort({ order: 1, name: 1 });
  res.json({ success: true, data: categories });
}

/** GET /api/categories/:slug — public. */
export async function getCategory(req: Request, res: Response) {
  const category = await CategoryModel.findOne({ slug: req.params.slug });
  if (!category) throw new ApiError(404, "Category not found.");
  res.json({ success: true, data: category });
}

/** POST /api/categories — admin only. */
export async function createCategory(req: Request, res: Response) {
  const { name, image, parentCategory, order } = req.body ?? {};
  if (!name || typeof name !== "string") throw new ApiError(400, "Category name is required.");

  const slug = slugify(name);
  if (await CategoryModel.exists({ slug })) {
    throw new ApiError(409, "A category with this name already exists.");
  }

  const category = await CategoryModel.create({
    name,
    slug,
    image: image ?? "",
    parentCategory: parentCategory || null,
    order: Number(order) || 0,
  });
  res.status(201).json({ success: true, data: category, message: "Category created." });
}

/** PUT /api/categories/:id — admin only. */
export async function updateCategory(req: Request, res: Response) {
  const category = await CategoryModel.findById(req.params.id);
  if (!category) throw new ApiError(404, "Category not found.");

  const { name, image, parentCategory, order } = req.body ?? {};
  if (typeof name === "string" && name.trim()) {
    category.name = name.trim();
    category.slug = slugify(name);
  }
  if (typeof image === "string") category.image = image;
  if (parentCategory !== undefined) category.parentCategory = parentCategory || null;
  if (order !== undefined) category.order = Number(order) || 0;

  await category.save();
  res.json({ success: true, data: category, message: "Category updated." });
}

/** DELETE /api/categories/:id — admin only. */
export async function deleteCategory(req: Request, res: Response) {
  const deleted = await CategoryModel.findByIdAndDelete(req.params.id);
  if (!deleted) throw new ApiError(404, "Category not found.");
  res.json({ success: true, message: "Category deleted." });
}
