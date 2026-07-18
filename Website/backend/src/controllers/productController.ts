import type { Request, Response } from "express";
import type { FilterQuery } from "mongoose";
import { ProductModel } from "../models/Product.js";
import { CategoryModel } from "../models/Category.js";
import { ApiError } from "../utils/ApiError.js";
import { getPageParams, paginate } from "../utils/pagination.js";
import { slugify } from "../utils/slugify.js";

const SORT_MAP: Record<string, Record<string, 1 | -1>> = {
  newest: { createdAt: -1 },
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  rating: { rating: -1 },
  discount: { discount: -1 },
};

/** Build a Mongo filter from query params (shared by listing & search). */
export async function buildProductFilter(req: Request): Promise<FilterQuery<unknown>> {
  const filter: FilterQuery<unknown> = { isActive: true };

  // Category by slug.
  if (req.query.category) {
    const cat = await CategoryModel.findOne({ slug: String(req.query.category) }).select("_id");
    // Unknown category -> impossible match so we return empty rather than everything.
    filter.category = cat ? cat._id : null;
  }

  if (req.query.brand) filter.brand = new RegExp(`^${escapeRegex(String(req.query.brand))}$`, "i");

  const min = Number(req.query.minPrice);
  const max = Number(req.query.maxPrice);
  if (!Number.isNaN(min) || !Number.isNaN(max)) {
    filter.price = {};
    if (!Number.isNaN(min)) (filter.price as Record<string, number>).$gte = min;
    if (!Number.isNaN(max)) (filter.price as Record<string, number>).$lte = max;
  }

  const minRating = Number(req.query.minRating ?? req.query.rating);
  if (!Number.isNaN(minRating) && minRating > 0) filter.rating = { $gte: minRating };

  const minDiscount = Number(req.query.minDiscount ?? req.query.discount);
  if (!Number.isNaN(minDiscount) && minDiscount > 0) filter.discount = { $gte: minDiscount };

  // availability=in -> only in-stock items
  if (req.query.availability === "in" || req.query.inStock === "true") {
    filter.stock = { $gt: 0 };
  }

  return filter;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * GET /api/products
 * Query: page, limit, category(slug), brand, minPrice, maxPrice, minRating,
 *        minDiscount, availability=in, sort=newest|price_asc|price_desc|rating|discount
 */
export async function listProducts(req: Request, res: Response) {
  const { page, limit, skip } = getPageParams(req);
  const filter = await buildProductFilter(req);
  const sort = SORT_MAP[String(req.query.sort)] ?? SORT_MAP.newest;

  const [items, total] = await Promise.all([
    ProductModel.find(filter).populate("category").sort(sort).skip(skip).limit(limit),
    ProductModel.countDocuments(filter),
  ]);

  res.json({ success: true, data: paginate(items, total, page, limit) });
}

/**
 * GET /api/products/admin/all — admin only.
 * Lists ALL products (active + inactive) so the admin panel can manage them.
 * Query: page, limit, q (matches title/sku/brand).
 */
export async function listAllProductsAdmin(req: Request, res: Response) {
  const { page, limit, skip } = getPageParams(req);
  const q = String(req.query.q ?? "").trim();

  const filter: FilterQuery<unknown> = {};
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ title: rx }, { sku: rx }, { brand: rx }];
  }

  const [items, total] = await Promise.all([
    ProductModel.find(filter).populate("category").sort({ createdAt: -1 }).skip(skip).limit(limit),
    ProductModel.countDocuments(filter),
  ]);

  res.json({ success: true, data: paginate(items, total, page, limit) });
}

/** GET /api/products/:slug — public. */
export async function getProduct(req: Request, res: Response) {
  const product = await ProductModel.findOne({ slug: req.params.slug }).populate("category");
  if (!product) throw new ApiError(404, "Product not found.");
  res.json({ success: true, data: product });
}

const WRITABLE = [
  "title", "description", "category", "brand", "images", "price", "mrp",
  "stock", "sku", "specifications", "tags", "isActive", "bulkPricing",
  "gstRate", "weight",
] as const;

/** POST /api/products — admin only. */
export async function createProduct(req: Request, res: Response) {
  const body = req.body ?? {};
  if (!body.title) throw new ApiError(400, "Product title is required.");
  if (body.price == null || body.mrp == null) throw new ApiError(400, "price and mrp are required.");
  if (!body.category) throw new ApiError(400, "category (id) is required.");
  if (!body.sku) throw new ApiError(400, "sku is required.");

  const slug = slugify(body.title);
  if (await ProductModel.exists({ slug })) {
    throw new ApiError(409, "A product with this title already exists.");
  }

  const product = await ProductModel.create({ ...pick(body, WRITABLE), slug });
  res.status(201).json({ success: true, data: product, message: "Product created." });
}

/** PUT /api/products/:id — admin only. */
export async function updateProduct(req: Request, res: Response) {
  const product = await ProductModel.findById(req.params.id);
  if (!product) throw new ApiError(404, "Product not found.");

  const updates = pick(req.body ?? {}, WRITABLE);
  product.set(updates);
  if (typeof req.body?.title === "string" && req.body.title.trim()) {
    product.slug = slugify(req.body.title);
  }
  await product.save();
  res.json({ success: true, data: product, message: "Product updated." });
}

/** DELETE /api/products/:id — admin only. */
export async function deleteProduct(req: Request, res: Response) {
  const deleted = await ProductModel.findByIdAndDelete(req.params.id);
  if (!deleted) throw new ApiError(404, "Product not found.");
  res.json({ success: true, message: "Product deleted." });
}

function pick<T extends object>(obj: T, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if ((obj as Record<string, unknown>)[k] !== undefined) {
      out[k] = (obj as Record<string, unknown>)[k];
    }
  }
  return out;
}
