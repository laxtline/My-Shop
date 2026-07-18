import type { Request, Response } from "express";
import type { FilterQuery } from "mongoose";
import { ProductModel } from "../models/Product.js";
import { buildProductFilter } from "./productController.js";
import { getPageParams, paginate } from "../utils/pagination.js";

const SORT_MAP: Record<string, Record<string, 1 | -1>> = {
  newest: { createdAt: -1 },
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  rating: { rating: -1 },
  discount: { discount: -1 },
};

/**
 * GET /api/search?q=&category=&minPrice=&maxPrice=&sort=&page=
 * Full-text search (title/description/tags/brand) combined with the same
 * filters as the product listing.
 */
export async function searchProducts(req: Request, res: Response) {
  const { page, limit, skip } = getPageParams(req);
  const q = String(req.query.q ?? "").trim();

  const filter: FilterQuery<unknown> = await buildProductFilter(req);
  const hasText = q.length > 0;
  if (hasText) filter.$text = { $search: q };

  // Relevance sort when searching text and no explicit sort given.
  const explicitSort = SORT_MAP[String(req.query.sort)];
  const sort = explicitSort ?? (hasText ? { score: { $meta: "textScore" } } : SORT_MAP.newest);

  const projection = hasText && !explicitSort ? { score: { $meta: "textScore" } } : {};

  const [items, total] = await Promise.all([
    ProductModel.find(filter, projection)
      .populate("category")
      .sort(sort as { [key: string]: 1 | -1 | { $meta: string } })
      .skip(skip)
      .limit(limit),
    ProductModel.countDocuments(filter),
  ]);

  res.json({ success: true, data: { query: q, ...paginate(items, total, page, limit) } });
}
