import type { Request, Response } from "express";
import mongoose from "mongoose";
import { ReviewModel } from "../models/Review.js";
import { ProductModel } from "../models/Product.js";
import { ApiError } from "../utils/ApiError.js";
import { getPageParams, paginate } from "../utils/pagination.js";

/** Recompute a product's average rating and review count from its reviews. */
async function recomputeProductRating(productId: mongoose.Types.ObjectId | string) {
  const id = new mongoose.Types.ObjectId(String(productId));
  const [agg] = await ReviewModel.aggregate<{ avg: number; count: number }>([
    { $match: { product: id } },
    { $group: { _id: "$product", avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  await ProductModel.findByIdAndUpdate(id, {
    rating: agg ? Math.round(agg.avg * 10) / 10 : 0,
    numReviews: agg ? agg.count : 0,
  });
}

/** GET /api/reviews/product/:productId — public. Reviews for a product, newest first. */
export async function listProductReviews(req: Request, res: Response) {
  const { productId } = req.params;
  if (!mongoose.isValidObjectId(productId)) throw new ApiError(400, "Invalid product id.");

  const { page, limit, skip } = getPageParams(req, 10, 50);
  const [items, total] = await Promise.all([
    ReviewModel.find({ product: productId }).sort({ createdAt: -1 }).skip(skip).limit(limit),
    ReviewModel.countDocuments({ product: productId }),
  ]);

  res.json({ success: true, data: paginate(items, total, page, limit) });
}

/**
 * POST /api/reviews — auth.
 * Body: { productId, rating (1-5), comment? }. Creates or updates the user's
 * review for that product, then recomputes the product's rating.
 */
export async function upsertReview(req: Request, res: Response) {
  const user = req.user!;
  const productId = String(req.body?.productId ?? "");
  const rating = Number(req.body?.rating);
  const comment = typeof req.body?.comment === "string" ? req.body.comment.slice(0, 1000) : "";

  if (!mongoose.isValidObjectId(productId)) throw new ApiError(400, "Invalid product id.");
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    throw new ApiError(400, "Rating must be a whole number from 1 to 5.");
  }

  const product = await ProductModel.findById(productId).select("_id");
  if (!product) throw new ApiError(404, "Product not found.");

  const review = await ReviewModel.findOneAndUpdate(
    { product: productId, user: user._id },
    {
      $set: {
        rating: Math.round(rating),
        comment,
        userName: user.name,
        userPicture: user.picture ?? "",
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  await recomputeProductRating(productId);

  res.status(201).json({ success: true, data: review, message: "Review saved." });
}

/** DELETE /api/reviews/:id — auth. Owner or admin. Recomputes product rating. */
export async function deleteReview(req: Request, res: Response) {
  const review = await ReviewModel.findById(req.params.id);
  if (!review) throw new ApiError(404, "Review not found.");

  const isOwner = review.user.toString() === req.user!._id.toString();
  if (!isOwner && req.user!.role !== "ADMIN") throw new ApiError(403, "Not allowed.");

  const productId = review.product;
  await review.deleteOne();
  await recomputeProductRating(productId);

  res.json({ success: true, message: "Review deleted." });
}
