import type { Request, Response } from "express";
import crypto from "node:crypto";
import { OrderModel } from "../models/Order.js";
import { ApiError } from "../utils/ApiError.js";
import { env, razorpayEnabled } from "../config/env.js";

const RAZORPAY_API = "https://api.razorpay.com/v1";

/** Basic-auth header for Razorpay's REST API (key_id:key_secret). */
function razorpayAuthHeader(): string {
  const token = Buffer.from(`${env.razorpayKeyId}:${env.razorpayKeySecret}`).toString("base64");
  return `Basic ${token}`;
}

/**
 * GET /api/payments/config — public.
 * Tells the storefront whether online payment is available and the public key id.
 */
export async function getPaymentConfig(_req: Request, res: Response) {
  res.json({
    success: true,
    data: {
      razorpayEnabled,
      razorpayKeyId: razorpayEnabled ? env.razorpayKeyId : "",
    },
  });
}

/**
 * POST /api/payments/razorpay/order — auth.
 * Body: { orderId }. Creates a Razorpay order for one of our PENDING orders
 * and returns the details the client needs to open Razorpay Checkout.
 */
export async function createRazorpayOrder(req: Request, res: Response) {
  if (!razorpayEnabled) throw new ApiError(503, "Online payment is not available right now.");

  const orderId = String(req.body?.orderId ?? "");
  const order = await OrderModel.findById(orderId);
  if (!order) throw new ApiError(404, "Order not found.");
  if (order.user.toString() !== req.user!._id.toString()) throw new ApiError(403, "Not allowed.");
  if (order.paymentMethod !== "RAZORPAY") throw new ApiError(400, "This order is not an online-payment order.");
  if (order.paymentStatus === "PAID") throw new ApiError(400, "This order is already paid.");
  if (order.status === "CANCELLED") throw new ApiError(400, "This order was cancelled and can no longer be paid.");

  const amount = Math.round(order.total * 100); // paise

  const resp = await fetch(`${RAZORPAY_API}/orders`, {
    method: "POST",
    headers: {
      Authorization: razorpayAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount,
      currency: "INR",
      receipt: order.id,
      notes: { orderId: order.id },
    }),
  });

  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    throw new ApiError(502, `Could not initiate payment. ${detail.slice(0, 200)}`);
  }

  const rzp = (await resp.json()) as { id: string; amount: number; currency: string };
  order.razorpayOrderId = rzp.id;
  await order.save();

  res.json({
    success: true,
    data: {
      keyId: env.razorpayKeyId,
      razorpayOrderId: rzp.id,
      amount: rzp.amount,
      currency: rzp.currency,
      orderId: order.id,
    },
  });
}

/**
 * POST /api/payments/razorpay/verify — auth.
 * Body: { orderId, razorpayPaymentId, razorpayOrderId, razorpaySignature }.
 * Verifies the HMAC signature and marks the order PAID on success.
 */
export async function verifyRazorpayPayment(req: Request, res: Response) {
  if (!razorpayEnabled) throw new ApiError(503, "Online payment is not available right now.");

  const { orderId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body ?? {};
  if (!orderId || !razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
    throw new ApiError(400, "Missing payment verification fields.");
  }

  const order = await OrderModel.findById(orderId);
  if (!order) throw new ApiError(404, "Order not found.");
  if (order.user.toString() !== req.user!._id.toString()) throw new ApiError(403, "Not allowed.");
  if (order.status === "CANCELLED") throw new ApiError(400, "This order was cancelled and can no longer be paid.");
  if (order.razorpayOrderId !== razorpayOrderId) throw new ApiError(400, "Payment order mismatch.");

  // Razorpay signature = HMAC_SHA256(razorpay_order_id + "|" + razorpay_payment_id, key_secret).
  const expected = crypto
    .createHmac("sha256", env.razorpayKeySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  const valid =
    expected.length === String(razorpaySignature).length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(razorpaySignature)));

  if (!valid) {
    order.paymentStatus = "FAILED";
    await order.save();
    throw new ApiError(400, "Payment verification failed. If money was deducted, it will be refunded.");
  }

  order.paymentStatus = "PAID";
  order.razorpayPaymentId = razorpayPaymentId;
  await order.save();

  res.json({ success: true, data: order, message: "Payment successful." });
}
