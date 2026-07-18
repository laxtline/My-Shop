import type { Request, Response } from "express";
import { WishlistModel } from "../models/Wishlist.js";
import { ProductModel } from "../models/Product.js";
import { ApiError } from "../utils/ApiError.js";

async function getOrCreateWishlist(userId: string) {
  let wl = await WishlistModel.findOne({ user: userId });
  if (!wl) wl = await WishlistModel.create({ user: userId, items: [] });
  return wl;
}

/** GET /api/wishlist — auth. Populated products. */
export async function getWishlist(req: Request, res: Response) {
  await getOrCreateWishlist(req.user!._id.toString());
  const wl = await WishlistModel.findOne({ user: req.user!._id.toString() }).populate("items");
  res.json({ success: true, data: wl });
}

/** POST /api/wishlist/add — body: { productId }. Idempotent (no duplicates). */
export async function addToWishlist(req: Request, res: Response) {
  const { productId } = req.body ?? {};
  if (!productId) throw new ApiError(400, "productId is required.");

  const product = await ProductModel.findById(productId).select("_id");
  if (!product) throw new ApiError(404, "Product not found.");

  const wl = await getOrCreateWishlist(req.user!._id.toString());
  if (!wl.items.some((id) => id.toString() === productId)) {
    wl.items.push(productId);
    await wl.save();
  }

  const populated = await WishlistModel.findById(wl._id).populate("items");
  res.status(201).json({ success: true, data: populated });
}

/** DELETE /api/wishlist/remove/:id — removes a product from the wishlist. */
export async function removeFromWishlist(req: Request, res: Response) {
  const productId = req.params.id;
  const wl = await getOrCreateWishlist(req.user!._id.toString());
  const before = wl.items.length;
  wl.items = wl.items.filter((id) => id.toString() !== productId);
  if (wl.items.length === before) throw new ApiError(404, "Item not in wishlist.");
  await wl.save();

  const populated = await WishlistModel.findById(wl._id).populate("items");
  res.json({ success: true, data: populated });
}
