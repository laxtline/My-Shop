import type { Request, Response } from 'express';
import { Types, type FilterQuery } from 'mongoose';
import { ProductModel } from '../models/Product.js';
import { CategoryModel } from '../models/Category.js';
import { ApiError } from '../utils/ApiError.js';
import { getPageParams, paginate } from '../utils/pagination.js';
import { slugify } from '../utils/slugify.js';
import { cursorFilter, cursorPage, type CursorSort } from '../utils/pagination.js';
import { isValidProductImageUrl } from '@shared/images.js';

// TODO: move this to a shared constants file
export const SORT_MAP = {
  newest: { createdAt: -1 },
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  rating: { rating: -1 },
  discount: { discount: -1 },
};

// Build Mongo filter from query params (shared by listing & search)
export async function buildProductFilter(req: Request): Promise<FilterQuery<unknown>> {
  const filter: FilterQuery<unknown> = { isActive: true };

  // Category by slug.
  if (req.query.category) {
    const cat = await CategoryModel.findOne({ slug: String(req.query.category) }).select("_id");
    // Unknown category -> impossible match so we return empty rather than everything.
    filter.category = cat ? cat._id : null;
  }

  if (req.query.brand) filter.brand = String(req.query.brand).slice(0, 120);

  const min = Number(req.query.minPrice);
  const max = Number(req.query.maxPrice);
  if (Number.isFinite(min) || Number.isFinite(max)) {
    filter.price = {};
    if (Number.isFinite(min)) (filter.price as Record<string, number>).$gte = Math.max(0, min);
    if (Number.isFinite(max)) (filter.price as Record<string, number>).$lte = Math.max(0, max);
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

// GET /api/products - query: page, limit, category, brand, minPrice, maxPrice, minRating, minDiscount, availability=in, sort
export async function listProducts(req: Request, res: Response) {
  return productListing(req, res, false);
}

export async function productListing(req: Request, res: Response, admin = false, search = false) {
  const { page, limit, skip } = getPageParams(req);
  const filter = await buildProductFilter(req);
  if (req.query.ids) {
    const ids = String(req.query.ids).split(',');
    if (ids.length > 200 || ids.some((id) => !Types.ObjectId.isValid(id))) throw new ApiError(400, 'Invalid product IDs.');
    filter._id = { $in: ids };
  }
  if (admin) {
    delete filter.isActive;
    if (req.query.status === 'active') filter.isActive = true;
    if (req.query.status === 'inactive') filter.isActive = false;
  }
  const q = String(req.query.q ?? '').trim().slice(0, 200);
  if (q) filter.$text = { $search: q };
  const sorts: Record<string, CursorSort> = {
    newest: { field: 'createdAt', direction: -1, kind: 'date' },
    price_asc: { field: 'price', direction: 1, kind: 'number' },
    price_desc: { field: 'price', direction: -1, kind: 'number' },
    rating: { field: 'rating', direction: -1, kind: 'number' },
    discount: { field: 'discount', direction: -1, kind: 'number' },
  };
  const sort = sorts[String(req.query.sort)] ?? sorts.newest;
  const scope = { admin, filter, sort };
  const [items, total] = await Promise.all([
    ProductModel.find({ $and: [filter, cursorFilter(req, sort, scope)] }).populate('category', 'name slug')
      .sort({ [sort.field]: sort.direction, _id: sort.direction }).skip(req.query.cursor ? 0 : skip).limit(limit + 1),
    ProductModel.countDocuments(filter),
  ]);
  if (!admin) res.set('Cache-Control', 'public, max-age=15, stale-while-revalidate=30');
  res.json({ success: true, data: { ...cursorPage(items, total, page, limit, sort, scope), ...(search ? { query: q } : {}) } });
}

// GET /api/products/admin/all - admin only. Lists ALL products (active + inactive)
// query: page, limit, q (matches title/sku/brand)
export async function listAllProductsAdmin(req: Request, res: Response) {
  return productListing(req, res, true);
}

// GET /api/products/:slug - public
export async function getProduct(req: Request, res: Response) {
  const product = await ProductModel.findOne({ slug: req.params.slug, isActive: true }).populate("category");
  if (!product) throw new ApiError(404, "Product not found.");
  res.json({ success: true, data: product });
}

const WRITABLE = [
  "title", "description", "category", "brand", "images", "price", "mrp",
  "stock", "sku", "specifications", "tags", "isActive", "bulkPricing",
  "gstRate", "weight",
] as const;

// POST /api/products - admin only
export async function createProduct(req: Request, res: Response) {
  const body = req.body ?? {};
  if (!body.title) throw new ApiError(400, "Product title is required.");
  if (body.price == null || body.mrp == null) throw new ApiError(400, "price and mrp are required.");
  if (!body.category) throw new ApiError(400, "category (id) is required.");
  if (!body.sku) throw new ApiError(400, "sku is required.");
  if (!await CategoryModel.exists({ _id: body.category })) throw new ApiError(400, 'Category does not exist.');
  validateImages(body.images ?? []);

  const slug = slugify(body.title);
  if (await ProductModel.exists({ slug })) {
    throw new ApiError(409, "A product with this title already exists.");
  }

  const product = await ProductModel.create({ ...pick(body, WRITABLE), slug });
  res.status(201).json({ success: true, data: product, message: "Product created." });
}

// PUT /api/products/:id - admin only
export async function updateProduct(req: Request, res: Response) {
  const product = await ProductModel.findById(req.params.id);
  if (!product) throw new ApiError(404, "Product not found.");

  const updates = pick(req.body ?? {}, WRITABLE);
  if (updates.category && !await CategoryModel.exists({ _id: updates.category })) throw new ApiError(400, 'Category does not exist.');
  if (updates.images !== undefined) validateImages(updates.images, product.images);
  product.set(updates);
  if (typeof req.body?.title === "string" && req.body.title.trim()) {
    product.slug = slugify(req.body.title);
  }
  await product.save();
  res.json({ success: true, data: product, message: "Product updated." });
}

function validateImages(images: unknown, existing: string[] = []) {
  if (!Array.isArray(images) || images.length > 20 || images.some((url) => typeof url !== 'string' ||
    url.length > 2000 || !isValidProductImageUrl(url) && !existing.includes(url))) {
    throw new ApiError(400, 'Provide up to 20 valid image URLs (ImageKit or uploaded images).');
  }
}

// DELETE /api/products/:id - admin only
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
