import type { Request, Response } from 'express';
import { CartModel } from '../models/Cart.js';
import { ProductModel } from '../models/Product.js';
import { ApiError } from '../utils/ApiError.js';
import { MAX_CART_LINES } from '@shared/pricing.js';
import mongoose from 'mongoose';

async function getOrCreateCart(userId: string) {
  let cart = await CartModel.findOne({ user: userId });
  if (!cart) cart = await CartModel.create({ user: userId, items: [] });
  return cart;
}

async function populatedCart(userId: string) {
  return CartModel.findOne({ user: userId }).populate('items.product');
}

/** Idempotent handoff from the mobile local cart; prices are never accepted. */
export async function mergeCart(req: Request, res: Response) {
  const incoming = req.body?.items;
  if (!Array.isArray(incoming) || !incoming.length || incoming.length > MAX_CART_LINES || incoming.some((line) =>
    !line || typeof line.productId !== 'string' || !mongoose.Types.ObjectId.isValid(line.productId) ||
    !Number.isSafeInteger(line.quantity) || line.quantity < 1)) throw new ApiError(400, 'Invalid mobile cart.');
  if (new Set(incoming.map((line) => line.productId)).size !== incoming.length) throw new ApiError(400, 'Duplicate products in mobile cart.');
  const userId = String(req.user!._id);
  await mongoose.connection.transaction(async (session) => {
    const products = await ProductModel.find({ _id: { $in: incoming.map((line) => line.productId) } }).select('stock isActive title').session(session);
    const byId = new Map(products.map((p) => [String(p._id), p]));
    let cart = await CartModel.findOne({ user: userId }).session(session);
    if (!cart) [cart] = await CartModel.create([{ user: userId, items: [] }], { session });
    for (const line of incoming) {
      const product = byId.get(line.productId);
      if (!product?.isActive) throw new ApiError(400, 'A mobile cart product is no longer available.');
      const existing = cart.items.find((item) => String(item.product) === line.productId);
      const quantity = Math.max(existing?.quantity ?? 0, line.quantity);
      if (quantity > product.stock) throw new ApiError(400, `Only ${product.stock} left of "${product.title}".`);
      if (existing) existing.quantity = quantity;
      else cart.items.push({ product: line.productId, quantity });
    }
    if (cart.items.length > MAX_CART_LINES) throw new ApiError(400, `A cart can contain at most ${MAX_CART_LINES} products.`);
    cart.lastUpdatedAt = new Date();
    await cart.save({ session });
  });
  res.json({ success: true, data: await populatedCart(userId) });
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

  if (!existing && cart.items.length >= MAX_CART_LINES) throw new ApiError(400, `A cart can contain at most ${MAX_CART_LINES} products.`);
  if (existing) existing.quantity = newQty;
  else cart.items.push({ product: productId, quantity });
  cart.lastUpdatedAt = new Date();
  await cart.save();

  res.status(201).json({ success: true, data: await populatedCart(req.user!._id.toString()) });
}

/** PUT /api/cart/update — body: { productId, quantity }. Sets absolute quantity. */
export async function updateCartItem(req: Request, res: Response) {
  const { productId } = req.body ?? {};
  const quantity = Number(req.body?.quantity);
  if (!productId || !Number.isSafeInteger(quantity) || quantity < 1) {
    throw new ApiError(400, "productId and quantity are required.");
  }

  const cart = await getOrCreateCart(req.user!._id.toString());
  const item = cart.items.find((i) => i.product.toString() === productId);
  if (!item) throw new ApiError(404, "Item not in cart.");

  const product = await ProductModel.findById(productId).select('stock isActive');
  if (!product?.isActive) throw new ApiError(400, 'This product is no longer available.');
  if (quantity > product.stock) throw new ApiError(400, `Only ${product.stock} in stock.`);
  item.quantity = quantity;
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
