import type { Request, Response } from "express";
import { CartModel } from "../models/Cart.js";
import { ProductModel } from "../models/Product.js";
import { ApiError } from "../utils/ApiError.js";

async function getOrCreateCart(userId: string) {
  let cart = await CartModel.findOne({ user: userId });
  if (!cart) cart = await CartModel.create({ user: userId, items: [] });
  return cart;
}

async function populatedCart(userId: string) {
  return CartModel.findOne({ user: userId }).populate("items.product");
}

/** GET /api/cart — auth. Returns the user's cart with populated products. */
export async function getCart(req: Request, res: Response) {
  await getOrCreateCart(req.user!._id.toString());
  const cart = await populatedCart(req.user!._id.toString());
  res.json({ success: true, data: cart });
}

/** POST /api/cart/add — body: { productId, quantity? }. Increments if present. */
export async function addToCart(req: Request, res: Response) {
  const { productId } = req.body ?? {};
  const quantity = Math.max(1, Math.floor(Number(req.body?.quantity) || 1));
  if (!productId) throw new ApiError(400, "productId is required.");

  const product = await ProductModel.findById(productId).select("stock isActive");
  if (!product || !product.isActive) throw new ApiError(404, "Product not found.");

  const cart = await getOrCreateCart(req.user!._id.toString());
  const existing = cart.items.find((i) => i.product.toString() === productId);
  const newQty = (existing?.quantity ?? 0) + quantity;
  if (newQty > product.stock) throw new ApiError(400, `Only ${product.stock} in stock.`);

  if (existing) existing.quantity = newQty;
  else cart.items.push({ product: productId, quantity });
  cart.lastUpdatedAt = new Date();
  await cart.save();

  res.status(201).json({ success: true, data: await populatedCart(req.user!._id.toString()) });
}

/** PUT /api/cart/update — body: { productId, quantity }. Sets absolute quantity. */
export async function updateCartItem(req: Request, res: Response) {
  const { productId } = req.body ?? {};
  const quantity = Math.floor(Number(req.body?.quantity));
  if (!productId || Number.isNaN(quantity)) {
    throw new ApiError(400, "productId and quantity are required.");
  }

  const cart = await getOrCreateCart(req.user!._id.toString());
  const item = cart.items.find((i) => i.product.toString() === productId);
  if (!item) throw new ApiError(404, "Item not in cart.");

  if (quantity <= 0) {
    cart.set(
      "items",
      cart.items.filter((i) => i.product.toString() !== productId)
    );
  } else {
    const product = await ProductModel.findById(productId).select("stock");
    if (product && quantity > product.stock) throw new ApiError(400, `Only ${product.stock} in stock.`);
    item.quantity = quantity;
  }
  cart.lastUpdatedAt = new Date();
  await cart.save();

  res.json({ success: true, data: await populatedCart(req.user!._id.toString()) });
}

/** DELETE /api/cart/remove/:id — removes a product line from the cart. */
export async function removeFromCart(req: Request, res: Response) {
  const productId = req.params.id;
  const cart = await getOrCreateCart(req.user!._id.toString());
  const before = cart.items.length;
  cart.set(
    "items",
    cart.items.filter((i) => i.product.toString() !== productId)
  );
  if (cart.items.length === before) throw new ApiError(404, "Item not in cart.");
  cart.lastUpdatedAt = new Date();
  await cart.save();

  res.json({ success: true, data: await populatedCart(req.user!._id.toString()) });
}
