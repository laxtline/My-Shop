import type { ClientSession, Types } from 'mongoose';
import { CartModel } from '../models/Cart.js';
import { ApiError } from '../utils/ApiError.js';
import { DELIVERY_FEE, FREE_DELIVERY_OVER, money, unitPriceForQty, MAX_CART_LINES } from '@shared/pricing.js';

export interface PricedLine {
  product: Types.ObjectId;
  category: Types.ObjectId;
  title: string;
  image: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export async function priceCart(userId: string, session?: ClientSession) {
  const cart = await CartModel.findOne({ user: userId }).session(session ?? null).populate('items.product');
  if (!cart?.items.length) throw new ApiError(400, 'Your cart is empty.');
  if (cart.items.length > MAX_CART_LINES) throw new ApiError(400, `A cart can contain at most ${MAX_CART_LINES} products.`);

  // Filter out products that are deleted or inactive — auto-clean the cart.
  const validItems = cart.items.filter((item) => {
    const p = item.product as unknown as {
      _id: Types.ObjectId; category: Types.ObjectId; title: string; images: string[];
      sku: string; price: number; stock: number; isActive: boolean;
      bulkPricing: { minQty: number; pricePerUnit: number }[];
    } | null;
    return !!p?.isActive;
  });

  // If some items were removed, persist the cleaned cart.
  if (validItems.length !== cart.items.length) {
    // Use set to properly replace Mongoose DocumentArray
    cart.items = validItems as any;
    cart.lastUpdatedAt = new Date();
    await cart.save({ session });
  }

  if (!validItems.length) throw new ApiError(400, 'Your cart is empty. All items are no longer available.');

  const items: PricedLine[] = validItems.map((item) => {
    const p = item.product as unknown as {
      _id: Types.ObjectId; category: Types.ObjectId; title: string; images: string[];
      sku: string; price: number; stock: number; isActive: boolean;
      bulkPricing: { minQty: number; pricePerUnit: number }[];
    };
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) throw new ApiError(400, 'Quantity must be a whole number of at least 1.');
    if (item.quantity > p.stock) throw new ApiError(400, `Only ${p.stock} left of "${p.title}". Update your cart.`);
    const unitPrice = unitPriceForQty(p, item.quantity);
    return { product: p._id, category: p.category, title: p.title, image: p.images[0] ?? '', sku: p.sku,
      quantity: item.quantity, unitPrice, lineTotal: money(unitPrice * item.quantity) };
  });
  const itemsTotal = money(items.reduce((sum, item) => sum + item.lineTotal, 0));
  const deliveryFee = itemsTotal >= FREE_DELIVERY_OVER ? 0 : DELIVERY_FEE;
  return { cart, items, itemsTotal, deliveryFee };
}
export type PricedCart = Awaited<ReturnType<typeof priceCart>>;
