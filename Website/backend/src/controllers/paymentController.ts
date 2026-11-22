import type { Request, Response } from "express";
import crypto from "node:crypto";
import { OrderModel } from "../models/Order.js";
import { RefundModel } from "../models/Refund.js";
import { ProcessedWebhookModel } from "../models/ProcessedWebhook.js";
import { ApiError } from "../utils/ApiError.js";
import { env, razorpayEnabled } from "../config/env.js";
import { getShippingSettings } from "../services/shipping/index.js";
import { completeRefundRecord, failRefundRecord, refundLateCapture } from "../services/refunds.js";
import { DEFAULT_SHIPPING_SETTINGS } from "@shared/shipping.js";
import type { PaymentChannel } from "@shared/types/index.js";

const RAZORPAY_API = "https://api.razorpay.com/v1";

/** Basic-auth header for Razorpay's REST API (key_id:key_secret). */
function razorpayAuthHeader(): string {
  const token = Buffer.from(`${env.razorpayKeyId}:${env.razorpayKeySecret}`).toString("base64");
  return `Basic ${token}`;
}

async function razorpayRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const resp = await fetch(`${RAZORPAY_API}${path}`, {
    ...init,
    headers: {
      Authorization: razorpayAuthHeader(),
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    throw new ApiError(502, `Razorpay request failed. ${detail.slice(0, 240)}`);
  }
  return (await resp.json()) as T;
}

/** Map Razorpay's instrument name onto our stored channel. */
function channelFromMethod(method?: string | null): PaymentChannel {
  switch (String(method ?? "").toLowerCase()) {
    case "card":
      return "CARD";
    case "upi":
      return "UPI";
    case "netbanking":
      return "NETBANKING";
    case "wallet":
      return "WALLET";
    default:
      return "UNKNOWN";
  }
}

/** UNKNOWN is replaced once Razorpay reports the real instrument. */
function shouldReplaceChannel(current?: string | null): boolean {
  return !current || current === "UNKNOWN" || current === "COD";
}

interface RazorpayPaymentEntity {
  id: string;
  order_id?: string;
  amount: number | { value: number; currency: string };
  currency?: string;
  status?: string;
  method?: string;
  created_at?: number;
  notes?: Record<string, string>;
}

function paymentAmount(payment: RazorpayPaymentEntity): number {
  return typeof payment.amount === "number" ? payment.amount : Number(payment.amount?.value ?? 0);
}

function paymentCurrency(payment: RazorpayPaymentEntity): string {
  return payment.currency ?? (typeof payment.amount === "object" ? payment.amount?.currency : "") ?? "INR";
}

/**
 * GET /api/payments/config — public.
 * The storefront and the mobile app both read this to decide which payment
 * options to show. COD availability comes from the shop's shipping settings.
 */
export async function getPaymentConfig(_req: Request, res: Response) {
  let settings = DEFAULT_SHIPPING_SETTINGS;
  try {
    settings = await getShippingSettings();
  } catch (error) {
    console.error("[payments] Could not load shipping settings for payment config:", error);
  }

  res.json({
    success: true,
    data: {
      razorpayEnabled,
      razorpayKeyId: razorpayEnabled ? env.razorpayKeyId : "",
      onlineMethods: razorpayEnabled ? ["UPI", "CARD", "NETBANKING", "WALLET"] : [],
      codEnabled: settings.codEnabled,
      codFee: settings.codFee,
      currency: "INR",
      paymentLinksEnabled: razorpayEnabled,
    },
  });
}

/** Create (or reuse) a Razorpay order for one of our orders. */
async function ensureRazorpayOrder(order: {
  _id: unknown;
  total: number;
  razorpayOrderId?: string;
  save: () => Promise<unknown>;
}) {
  if (order.razorpayOrderId) return { id: order.razorpayOrderId, amount: Math.round(order.total * 100), currency: "INR" };

  const orderRef = String(order._id);
  const rzp = await razorpayRequest<{ id: string; amount: number; currency: string }>("/orders", {
    method: "POST",
    body: JSON.stringify({
      amount: Math.round(order.total * 100),
      currency: "INR",
      receipt: orderRef,
      notes: { orderId: orderRef },
    }),
  });
  order.razorpayOrderId = rzp.id;
  await order.save();
  return rzp;
}

/**
 * POST /api/payments/razorpay/order — auth.
 * Body: { orderId, preferredMethod? }. Returns what Razorpay Checkout needs.
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

  // Remember the customer's preferred instrument so the UI can pre-select it.
  const preferred = String(req.body?.preferredMethod ?? "").toUpperCase();
  if (["UPI", "CARD", "NETBANKING", "WALLET"].includes(preferred)) {
    order.paymentChannel = preferred as PaymentChannel;
    await order.save();
  }

  const rzp = await ensureRazorpayOrder(order);

  res.json({
    success: true,
    data: {
      keyId: env.razorpayKeyId,
      razorpayOrderId: rzp.id,
      amount: rzp.amount,
      currency: rzp.currency,
      orderId: order.id,
      preferredMethod: order.paymentChannel,
      paymentStatus: order.paymentStatus,
    },
  });
}

/**
 * POST /api/payments/razorpay/verify — auth.
 * Body: { orderId, razorpayPaymentId, razorpayOrderId, razorpaySignature }.
 * Verifies the HMAC signature, then confirms the captured amount with Razorpay
 * before marking the order PAID.
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
  if (order.razorpayOrderId !== razorpayOrderId) throw new ApiError(400, "Payment order mismatch.");

  // Razorpay signature = HMAC_SHA256(razorpay_order_id + "|" + razorpay_payment_id, key_secret).
  const expected = crypto
    .createHmac("sha256", env.razorpayKeySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  const provided = String(razorpaySignature);
  const valid =
    expected.length === provided.length &&
    /^[a-f0-9]+$/i.test(provided) &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));

  if (!valid) {
    if (order.paymentStatus === "PENDING") {
      order.paymentStatus = "FAILED";
      await order.save();
    }
    throw new ApiError(400, "Payment verification failed. If money was deducted, it will be refunded.");
  }

  // Never trust the browser: fetch the payment and confirm it is captured.
  const payment = await razorpayRequest<RazorpayPaymentEntity>(
    `/payments/${encodeURIComponent(String(razorpayPaymentId))}`
  );

  if (payment.status !== "captured") {
    throw new ApiError(409, `Payment is ${payment.status ?? "not captured"}. Complete the payment and try again.`);
  }
  if (payment.order_id && payment.order_id !== razorpayOrderId) {
    throw new ApiError(400, "Payment does not belong to this order.");
  }
  if (paymentAmount(payment) !== Math.round(order.total * 100) || paymentCurrency(payment) !== "INR") {
    throw new ApiError(400, "Payment amount does not match the order total. Contact support.");
  }

  await applyCapturedPayment(order, payment);
  res.json({ success: true, data: order, message: "Payment successful." });
}

/**
 * POST /api/payments/razorpay/link — auth.
 * Mobile has no Checkout.js, so create a hosted Razorpay payment link and let
 * the app open it in a browser. The app then polls /status/:orderId.
 */
export async function createRazorpayPaymentLink(req: Request, res: Response) {
  if (!razorpayEnabled) throw new ApiError(503, "Online payment is not available right now.");

  const orderId = String(req.body?.orderId ?? "");
  const order = await OrderModel.findById(orderId).populate("user", "name email");
  if (!order) throw new ApiError(404, "Order not found.");
  if (order.user._id.toString() !== req.user!._id.toString()) throw new ApiError(403, "Not allowed.");
  if (order.paymentMethod !== "RAZORPAY") throw new ApiError(400, "This order is not an online-payment order.");
  if (order.paymentStatus === "PAID") throw new ApiError(400, "This order is already paid.");
  if (order.status === "CANCELLED") throw new ApiError(400, "This order was cancelled and can no longer be paid.");

  // Before issuing another link, ask the gateway whether an earlier attempt
  // actually captured. This prevents a double charge when the customer closes
  // the browser before polling and then taps "Retry payment".
  try {
    await reconcilePayment(order);
  } catch (error) {
    console.warn("[payments] Pre-link reconciliation failed:", error);
  }
  // Re-read instead of trusting the in-memory document: reconcile may have
  // marked the order PAID in the database after the first check above.
  const afterReconcile = await OrderModel.findById(order.id).select("paymentStatus");
  if (afterReconcile?.paymentStatus === "PAID") {
    throw new ApiError(400, "This order is already paid.");
  }

  // reference_id must be unique across the merchant account, so include a
  // short retry suffix when the customer asks for a fresh link.
  const referenceId = `ord_${order.id}_${Date.now().toString(36).slice(-4)}`;
  const customer = order.user as unknown as { name?: string; email?: string };

  const link = await razorpayRequest<{
    id: string;
    short_url: string;
    amount: number;
    currency: string;
    expire_by?: number;
    status?: string;
  }>("/payment_links", {
    method: "POST",
    body: JSON.stringify({
      amount: Math.round(order.total * 100),
      currency: "INR",
      accept_partial: false,
      reference_id: referenceId,
      description: `Order ${order.id}`,
      customer: {
        name: customer?.name ?? order.shippingAddress.fullName,
        contact: order.shippingAddress.phone,
        ...(customer?.email ? { email: customer.email } : {}),
      },
      notify: { sms: false, email: false },
      reminder_enable: false,
      notes: { orderId: order.id },
      ...(env.mobilePaymentReturnUrl && /^https?:\/\//i.test(env.mobilePaymentReturnUrl)
        ? { callback_url: env.mobilePaymentReturnUrl, callback_method: "get" }
        : {}),
    }),
  });

  order.razorpayPaymentLinkId = link.id;
  await order.save();

  res.status(201).json({
    success: true,
    data: {
      shortUrl: link.short_url,
      orderId: order.id,
      amount: link.amount,
      currency: link.currency,
      expiresAt: link.expire_by ? new Date(link.expire_by * 1000).toISOString() : null,
    },
  });
}

/**
 * GET /api/payments/status/:orderId — auth.
 * Used by the mobile app after the hosted page. Doubles as a reconciliation
 * path when webhooks are not configured: if the order is still PENDING and a
 * payment link exists, we ask Razorpay directly.
 */
export async function getPaymentStatus(req: Request, res: Response) {
  const order = await OrderModel.findById(req.params.orderId);
  if (!order) throw new ApiError(404, "Order not found.");
  if (order.user.toString() !== req.user!._id.toString() && req.user!.role !== "ADMIN") {
    throw new ApiError(403, "Not allowed.");
  }

  if (order.paymentMethod === "RAZORPAY" && order.paymentStatus !== "PAID" && razorpayEnabled) {
    try {
      await reconcilePayment(order);
    } catch (error) {
      console.error("[payments] Status reconciliation failed:", error);
    }
  }

  res.json({
    success: true,
    data: {
      orderId: order.id,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      paymentChannel: order.paymentChannel,
      paidAt: order.paidAt ?? null,
      total: order.total,
      status: order.status,
    },
  });
}

/** Ask Razorpay whether a hosted payment link has been paid. */
async function reconcilePayment(order: any) {
  if (order.razorpayPaymentLinkId) {
    const link = await razorpayRequest<{
      id: string;
      status: string;
      payments?: Array<{ payment_id: string; method?: string; status?: string; amount?: number }> | null;
    }>(`/payment_links/${encodeURIComponent(order.razorpayPaymentLinkId)}`);

    if (link.status === "paid" && link.payments?.length) {
      const entry = link.payments[link.payments.length - 1];
      const payment = await razorpayRequest<RazorpayPaymentEntity>(
        `/payments/${encodeURIComponent(entry.payment_id)}`
      );
      await applyCapturedPayment(order, payment);
      return true;
    }
  }

  if (order.razorpayOrderId) {
    const list = await razorpayRequest<{ items?: RazorpayPaymentEntity[] }>(
      `/orders/${encodeURIComponent(order.razorpayOrderId)}/payments`
    );
    const captured = (list.items ?? []).find(
      (item) => item.status === "captured" && paymentAmount(item) === Math.round(order.total * 100)
    );
    if (captured) {
      await applyCapturedPayment(order, captured);
      return true;
    }
  }

  return false;
}

/**
 * Mark an order PAID from a captured Razorpay payment. Handles the cancelled
 * order race by returning the money instead of resurrecting the order.
 */
async function applyCapturedPayment(order: any, payment: RazorpayPaymentEntity) {
  // Already applied for this exact payment — nothing to do.
  if (order.paymentStatus === "PAID" && order.razorpayPaymentId === payment.id) return;

  const amount = paymentAmount(payment);
  const currency = paymentCurrency(payment) || "INR";

  if (currency !== "INR" || amount !== Math.round(order.total * 100)) {
    console.error(
      `[payments] Amount mismatch for order ${order.id}: expected ${Math.round(order.total * 100)} INR, got ${amount} ${currency}`
    );
    if (order.paymentStatus !== "PAID") {
      order.paymentStatus = "FAILED";
      await order.save();
    }
    return;
  }

  order.razorpayPaymentId = payment.id;
  if (payment.order_id) order.razorpayOrderId = payment.order_id;
  if (shouldReplaceChannel(order.paymentChannel) || payment.method) {
    order.paymentChannel = payment.method ? channelFromMethod(payment.method) : order.paymentChannel;
  }
  order.paidAt = payment.created_at ? new Date(payment.created_at * 1000) : new Date();

  // Payment captured after cancellation: don't fulfil, refund instead.
  if (order.status === "CANCELLED") {
    await order.save();
    await refundLateCapture(order);
    return;
  }

  if (order.paymentStatus !== "PAID") {
    order.paymentStatus = "PAID";
    order.statusHistory.push({
      status: order.status,
      timestamp: new Date(),
      note: `Payment received (${order.paymentChannel}) — ₹${order.total.toLocaleString("en-IN")}`,
    });
  }
  await order.save();
}

/**
 * POST /api/payments/razorpay/webhook — public (Razorpay callback).
 * Verified by signature; idempotency is durable in MongoDB.
 */
export async function razorpayWebhook(req: Request, res: Response) {
  if (!razorpayEnabled) {
    return res.status(503).json({ success: false, message: "Online payment is not available." });
  }

  const webhookSecret = env.razorpayWebhookSecret;
  if (!webhookSecret) {
    console.error("[webhook] Razorpay webhook secret not configured");
    return res.status(500).json({ success: false, message: "Webhook not configured." });
  }

  const signature = req.headers["x-razorpay-signature"] as string;
  if (!signature) {
    return res.status(400).json({ success: false, message: "Missing webhook signature." });
  }

  // Raw body is a Buffer from express.raw — required for signature checks.
  const rawBody = req.body as Buffer;
  if (!rawBody || rawBody.length === 0) {
    return res.status(400).json({ success: false, message: "Empty webhook payload." });
  }

  const expectedSignature = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");

  if (signature.length !== expectedSignature.length || !/^[a-f0-9]+$/i.test(signature)) {
    console.error("[webhook] Invalid webhook signature format");
    return res.status(400).json({ success: false, message: "Invalid signature format." });
  }

  const valid = crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature));
  if (!valid) {
    console.error("[webhook] Invalid webhook signature");
    return res.status(400).json({ success: false, message: "Invalid signature." });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return res.status(400).json({ success: false, message: "Invalid JSON payload." });
  }

  const eventId = String(event.id ?? "");
  if (eventId) {
    const seen = await ProcessedWebhookModel.exists({ provider: "razorpay", eventId });
    if (seen) {
      return res.json({ success: true, message: "Event already processed." });
    }
  }

  try {
    switch (event.event) {
      case "payment.captured":
        await handleCapturedEntity(event.payload?.payment?.entity);
        break;
      case "order.paid":
        // order.paid does not always include the payment entity; the order
        // payments endpoint fills the gap.
        await handleOrderPaid(event.payload?.order?.entity);
        break;
      case "payment.failed":
        await handlePaymentFailed(event.payload?.payment?.entity);
        break;
      case "payment_link.paid": {
        const payment = event.payload?.payment?.entity;
        if (payment) {
          await handleCapturedEntity(payment);
        } else {
          const orderId = event.payload?.payment_link?.entity?.notes?.orderId;
          if (orderId) {
            const order = await OrderModel.findById(orderId);
            if (order) await reconcilePayment(order);
          }
        }
        break;
      }
      case "refund.processed":
        await handleRefundEvent(event.payload?.refund?.entity, true);
        break;
      case "refund.failed":
        await handleRefundEvent(event.payload?.refund?.entity, false);
        break;
      default:
        console.log(`[webhook] Unhandled event type: ${event.event}`);
    }

    if (eventId) {
      try {
        await ProcessedWebhookModel.create({
          provider: "razorpay",
          eventId,
          eventType: String(event.event ?? ""),
        });
      } catch (error: any) {
        // A concurrent delivery already recorded this event; harmless.
        if (error?.code !== 11000) throw error;
      }
    }

    res.json({ success: true, message: "Webhook processed." });
  } catch (error) {
    console.error("[webhook] Error processing webhook:", error);
    res.status(500).json({ success: false, message: "Webhook processing failed." });
  }
}

async function handleCapturedEntity(payment: RazorpayPaymentEntity | undefined) {
  if (!payment?.id) return;
  const orderId = payment.notes?.orderId;
  if (!orderId) {
    console.warn("[webhook] No orderId in payment notes");
    return;
  }

  const order = await OrderModel.findById(orderId);
  if (!order) {
    console.warn(`[webhook] Order ${orderId} not found`);
    return;
  }
  await applyCapturedPayment(order, payment);
}

/** payment.failed only downgrades an order that has not been paid. */
async function handlePaymentFailed(payment: RazorpayPaymentEntity | undefined) {
  if (!payment) return;
  const orderId = payment.notes?.orderId;
  if (!orderId) return;

  const order = await OrderModel.findById(orderId);
  if (!order) return;
  if (order.paymentStatus !== "PENDING" || order.status === "CANCELLED") return;
  // Ignore a late failure for a different attempt than the established order.
  if (order.razorpayOrderId && payment.order_id && payment.order_id !== order.razorpayOrderId) return;

  order.paymentStatus = "FAILED";
  await order.save();
  console.log(`[webhook] Order ${orderId} marked FAILED (payment ${payment.id})`);
}

/** Fallback for when payment.captured is not delivered. */
async function handleOrderPaid(orderEntity: any) {
  if (!orderEntity) return;
  const orderId = orderEntity.notes?.orderId;
  if (!orderId) return;

  const order = await OrderModel.findById(orderId);
  if (!order) return;
  if (order.paymentStatus === "PAID") return;

  // Confirm via the payments list — order.paid lacks the payment id/instrument.
  try {
    await reconcilePayment(order);
  } catch (error) {
    console.error("[webhook] order.paid reconciliation failed:", error);
  }
}

/** refund.processed / refund.failed — complete or fail our stored refund. */
async function handleRefundEvent(refundEntity: any, succeeded: boolean) {
  if (!refundEntity) return;

  let refund = refundEntity.id
    ? await RefundModel.findOne({ razorpayRefundId: refundEntity.id })
    : null;

  if (!refund && refundEntity.payment_id) {
    refund = await RefundModel.findOne({
      razorpayPaymentId: refundEntity.payment_id,
      status: "PENDING",
    }).sort({ createdAt: -1 });
  }

  if (!refund) {
    console.warn(`[webhook] Refund ${refundEntity.id ?? "unknown"} does not match a stored refund`);
    return;
  }

  if (succeeded) {
    await completeRefundRecord(String(refund._id), refundEntity.id);
  } else {
    await failRefundRecord(
      String(refund._id),
      refundEntity.failure_reason || refundEntity.status || "Refund failed at the gateway"
    );
  }
}
