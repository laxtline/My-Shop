import type { Request, Response } from "express";
import mongoose from "mongoose";
import { OrderModel } from "../models/Order.js";
import { CartModel } from "../models/Cart.js";
import { ProductModel } from "../models/Product.js";
import { UserModel } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { getPageParams, paginate } from "../utils/pagination.js";
import { sendOrderPlacedEmail, sendOrderStatusEmail } from "../utils/email.js";
import { resolveCoupon } from "./couponController.js";
import type { OrderStatus, ShippingAddress } from "@shared/types/index.js";

/** Flat delivery fee below the free-shipping threshold. */
const DELIVERY_FEE = 49;
const FREE_DELIVERY_OVER = 5000;

const REQUIRED_ADDRESS_FIELDS: (keyof ShippingAddress)[] = [
  "fullName",
  "phone",
  "line1",
  "city",
  "state",
  "pincode",
];

/** Effective per-unit price honouring bulk-pricing tiers (mirrors the client helper). */
function unitPriceForQty(
  product: { price: number; bulkPricing?: { minQty: number; pricePerUnit: number }[] },
  qty: number
): number {
  let best = product.price;
  for (const tier of product.bulkPricing ?? []) {
    if (qty >= tier.minQty && tier.pricePerUnit < best) best = tier.pricePerUnit;
  }
  return best;
}

function validateAddress(input: unknown): ShippingAddress {
  const a = (input ?? {}) as Record<string, string>;
  for (const field of REQUIRED_ADDRESS_FIELDS) {
    if (!a[field] || String(a[field]).trim() === "") {
      throw new ApiError(400, `Shipping address: ${field} is required.`);
    }
  }
  if (!/^\d{6}$/.test(a.pincode.trim())) throw new ApiError(400, "Pincode must be 6 digits.");
  if (!/^\d{10}$/.test(a.phone.replace(/\D/g, "").slice(-10))) {
    throw new ApiError(400, "A valid 10-digit phone number is required.");
  }
  return {
    fullName: a.fullName.trim(),
    phone: a.phone.trim(),
    line1: a.line1.trim(),
    line2: (a.line2 ?? "").trim(),
    city: a.city.trim(),
    state: a.state.trim(),
    pincode: a.pincode.trim(),
  };
}

/**
 * POST /api/orders — auth. Places an order from the user's current cart.
 * Body: { shippingAddress, paymentMethod?, notes? }.
 * Totals and stock are recomputed server-side; the client cannot set prices.
 */
export async function createOrder(req: Request, res: Response) {
  const userId = req.user!._id.toString();
  const shippingAddress = validateAddress(req.body?.shippingAddress);
  const paymentMethod = req.body?.paymentMethod === "RAZORPAY" ? "RAZORPAY" : "COD";
  const notes = typeof req.body?.notes === "string" ? req.body.notes.slice(0, 500) : "";

  const cart = await CartModel.findOne({ user: userId }).populate("items.product");
  if (!cart || cart.items.length === 0) throw new ApiError(400, "Your cart is empty.");

  // Build immutable line snapshots, validating stock as we go.
  const items = cart.items.map((it) => {
    const p = it.product as unknown as {
      _id: mongoose.Types.ObjectId;
      title: string;
      images: string[];
      sku: string;
      price: number;
      stock: number;
      isActive: boolean;
      bulkPricing?: { minQty: number; pricePerUnit: number }[];
    } | null;

    if (!p || !p.isActive) throw new ApiError(400, "A product in your cart is no longer available.");
    if (it.quantity > p.stock) {
      throw new ApiError(400, `Only ${p.stock} left of "${p.title}". Please update your cart.`);
    }
    const unitPrice = unitPriceForQty(p, it.quantity);
    return {
      product: p._id,
      title: p.title,
      image: p.images?.[0] ?? "",
      sku: p.sku,
      unitPrice,
      quantity: it.quantity,
      lineTotal: unitPrice * it.quantity,
    };
  });

  const itemsTotal = items.reduce((sum, i) => sum + i.lineTotal, 0);
  const deliveryFee = itemsTotal >= FREE_DELIVERY_OVER ? 0 : DELIVERY_FEE;

  // Apply a coupon if supplied — re-validated server-side (client cannot set the discount).
  const couponInput = typeof req.body?.couponCode === "string" ? req.body.couponCode.trim() : "";
  let discount = 0;
  let appliedCode = "";
  if (couponInput) {
    const resolved = await resolveCoupon(couponInput, itemsTotal);
    discount = resolved.discount;
    appliedCode = resolved.coupon.code;
  }

  const total = Math.max(0, itemsTotal + deliveryFee - discount);

  // Decrement stock for each line. (Single-node best-effort; a replica set would
  // allow a transaction here — noted for the scaling story.) If a line fails,
  // roll back the decrements already applied so no stock is lost.
  const decremented: { product: mongoose.Types.ObjectId; quantity: number }[] = [];
  for (const line of items) {
    const updated = await ProductModel.findOneAndUpdate(
      { _id: line.product, stock: { $gte: line.quantity } },
      { $inc: { stock: -line.quantity } },
      { new: true }
    );
    if (!updated) {
      for (const done of decremented) {
        await ProductModel.findByIdAndUpdate(done.product, { $inc: { stock: done.quantity } });
      }
      throw new ApiError(409, `"${line.title}" just went out of stock. Please try again.`);
    }
    decremented.push({ product: line.product, quantity: line.quantity });
  }

  const order = await OrderModel.create({
    user: userId,
    items,
    shippingAddress,
    paymentMethod,
    paymentStatus: "PENDING",
    status: "PLACED",
    itemsTotal,
    deliveryFee,
    couponCode: appliedCode,
    discount,
    total,
    notes,
  });

  // Empty the cart now that the order is captured.
  cart.set("items", []);
  cart.lastUpdatedAt = new Date();
  await cart.save();

  // Fire-and-forget confirmation email (never blocks the response).
  void sendOrderPlacedEmail(req.user!.email, order);

  res.status(201).json({ success: true, data: order, message: "Order placed successfully." });
}

/** GET /api/orders — auth. The current user's orders, newest first. */
export async function listMyOrders(req: Request, res: Response) {
  const userId = req.user!._id.toString();
  const { page, limit, skip } = getPageParams(req, 10, 50);

  const [items, total] = await Promise.all([
    OrderModel.find({ user: userId }).sort({ createdAt: -1 }).skip(skip).limit(limit),
    OrderModel.countDocuments({ user: userId }),
  ]);

  res.json({ success: true, data: paginate(items, total, page, limit) });
}

/** GET /api/orders/:id — auth. One order; owner or admin only. */
export async function getOrder(req: Request, res: Response) {
  const order = await OrderModel.findById(req.params.id).populate("user", "name email");
  if (!order) throw new ApiError(404, "Order not found.");

  const isOwner = order.user && order.user._id?.toString() === req.user!._id.toString();
  if (!isOwner && req.user!.role !== "ADMIN") throw new ApiError(403, "Not allowed.");

  res.json({ success: true, data: order });
}

/** PATCH /api/orders/:id/cancel — auth. Owner cancels while still PLACED/CONFIRMED. */
export async function cancelOrder(req: Request, res: Response) {
  const order = await OrderModel.findById(req.params.id);
  if (!order) throw new ApiError(404, "Order not found.");
  if (order.user.toString() !== req.user!._id.toString()) throw new ApiError(403, "Not allowed.");
  if (!["PLACED", "CONFIRMED"].includes(order.status)) {
    throw new ApiError(400, `Cannot cancel an order that is already ${order.status.toLowerCase()}.`);
  }

  // Restock the cancelled items.
  for (const line of order.items) {
    if (line.product) {
      await ProductModel.findByIdAndUpdate(line.product, { $inc: { stock: line.quantity } });
    }
  }
  order.status = "CANCELLED";
  await order.save();

  void sendOrderStatusEmail(req.user!.email, order);

  res.json({ success: true, data: order, message: "Order cancelled." });
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

const STATUS_FLOW: Record<OrderStatus, OrderStatus[]> = {
  PLACED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

/** GET /api/orders/admin/all — admin. All orders, optional ?status filter. */
export async function listAllOrders(req: Request, res: Response) {
  const { page, limit, skip } = getPageParams(req, 15, 100);
  const filter: Record<string, unknown> = {};
  const status = String(req.query.status ?? "").toUpperCase();
  if (status && status in STATUS_FLOW) filter.status = status;

  const [items, total] = await Promise.all([
    OrderModel.find(filter).populate("user", "name email").sort({ createdAt: -1 }).skip(skip).limit(limit),
    OrderModel.countDocuments(filter),
  ]);

  res.json({ success: true, data: paginate(items, total, page, limit) });
}

/** PATCH /api/orders/:id/status — admin. Advances the order along the allowed flow. */
export async function updateOrderStatus(req: Request, res: Response) {
  const next = String(req.body?.status ?? "").toUpperCase() as OrderStatus;
  const order = await OrderModel.findById(req.params.id);
  if (!order) throw new ApiError(404, "Order not found.");

  const allowed = STATUS_FLOW[order.status as OrderStatus] ?? [];
  if (!allowed.includes(next)) {
    throw new ApiError(400, `Cannot change status from ${order.status} to ${next || "(none)"}.`);
  }

  // Restock if an admin cancels; mark COD paid on delivery.
  if (next === "CANCELLED") {
    for (const line of order.items) {
      if (line.product) {
        await ProductModel.findByIdAndUpdate(line.product, { $inc: { stock: line.quantity } });
      }
    }
  }
  if (next === "DELIVERED" && order.paymentMethod === "COD") {
    order.paymentStatus = "PAID";
  }
  order.status = next;
  await order.save();

  // Notify the customer of the status change (fire-and-forget).
  const owner = await UserModel.findById(order.user).select("email");
  if (owner?.email) void sendOrderStatusEmail(owner.email, order);

  res.json({ success: true, data: order, message: `Order marked ${next}.` });
}

/**
 * GET /api/orders/admin/analytics — admin.
 * Revenue/orders for the last 14 days + the top-selling products.
 */
export async function orderAnalytics(_req: Request, res: Response) {
  const since = new Date();
  since.setDate(since.getDate() - 13); // 14-day window including today
  since.setHours(0, 0, 0, 0);

  const [revenueByDay, topProducts] = await Promise.all([
    OrderModel.aggregate([
      { $match: { status: { $ne: "CANCELLED" }, createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          revenue: { $sum: "$total" },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    OrderModel.aggregate([
      { $match: { status: { $ne: "CANCELLED" } } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.title",
          qty: { $sum: "$items.quantity" },
          revenue: { $sum: "$items.lineTotal" },
        },
      },
      { $sort: { qty: -1 } },
      { $limit: 5 },
    ]),
  ]);

  res.json({
    success: true,
    data: {
      revenueByDay: revenueByDay.map((r) => ({ date: r._id, revenue: r.revenue, orders: r.orders })),
      topProducts: topProducts.map((p) => ({ title: p._id, qty: p.qty, revenue: p.revenue })),
    },
  });
}

/** GET /api/orders/admin/stats — admin. Headline metrics for the dashboard. */
export async function orderStats(_req: Request, res: Response) {
  const [byStatus, revenueAgg, totalOrders] = await Promise.all([
    OrderModel.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    OrderModel.aggregate([
      { $match: { status: { $ne: "CANCELLED" } } },
      { $group: { _id: null, revenue: { $sum: "$total" } } },
    ]),
    OrderModel.countDocuments({}),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const row of byStatus) statusCounts[row._id] = row.count;

  res.json({
    success: true,
    data: {
      totalOrders,
      revenue: revenueAgg[0]?.revenue ?? 0,
      statusCounts,
    },
  });
}
