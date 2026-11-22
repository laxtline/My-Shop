import type { Order, RazorpayOrderInfo } from "@shared/types";
import { apiFetch } from "@/lib/api";

// Minimal typing for the Razorpay Checkout global injected by their script.
interface RazorpayInstance {
  open(): void;
  on(event: string, handler: (response: unknown) => void): void;
}
interface RazorpayConstructor {
  new (options: Record<string, unknown>): RazorpayInstance;
}
declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

export interface RazorpayResult {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";
let scriptPromise: Promise<boolean> | null = null;

/** Lazily inject the Razorpay Checkout script once. */
export function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<boolean>((resolve) => {
    const s = document.createElement("script");
    s.src = CHECKOUT_SRC;
    s.onload = () => resolve(true);
    s.onerror = () => {
      scriptPromise = null;
      resolve(false);
    };
    document.body.appendChild(s);
  });
  return scriptPromise;
}

interface CheckoutOptions {
  keyId: string;
  amount: number; // paise
  currency: string;
  orderId: string; // razorpay order id
  name: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  themeColor?: string;
}

/** Open Razorpay Checkout; resolves with the signed result or rejects if cancelled/failed. */
export async function openRazorpayCheckout(opts: CheckoutOptions): Promise<RazorpayResult> {
  const ok = await loadRazorpayScript();
  if (!ok || !window.Razorpay) {
    throw new Error("Could not load the payment gateway. Check your connection and try again.");
  }

  return new Promise<RazorpayResult>((resolve, reject) => {
    const rzp = new window.Razorpay!({
      key: opts.keyId,
      amount: opts.amount,
      currency: opts.currency,
      order_id: opts.orderId,
      name: opts.name,
      description: opts.description ?? "",
      prefill: opts.prefill ?? {},
      theme: { color: opts.themeColor ?? "#2563eb" },
      handler: (response: unknown) => resolve(response as RazorpayResult),
      modal: { ondismiss: () => reject(new Error("Payment cancelled.")) },
    });
    rzp.on("payment.failed", (resp: unknown) => {
      const desc = (resp as { error?: { description?: string } })?.error?.description;
      reject(new Error(desc ?? "Payment failed. Please try again."));
    });
    rzp.open();
  });
}

/**
 * Full online-payment flow for an already-placed order:
 * create a Razorpay order -> open checkout -> verify signature server-side.
 * Returns the updated (PAID) order. Throws if cancelled or verification fails.
 */
export async function payForOrder(params: {
  orderId: string;
  brandName: string;
  themeColor?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  /** Instrument the customer picked on the storefront (informational). */
  preferredMethod?: string;
}): Promise<Order> {
  const info = await apiFetch<RazorpayOrderInfo>("/api/payments/razorpay/order", {
    method: "POST",
    body: JSON.stringify({ orderId: params.orderId, preferredMethod: params.preferredMethod }),
  });

  const result = await openRazorpayCheckout({
    keyId: info.keyId,
    amount: info.amount,
    currency: info.currency,
    orderId: info.razorpayOrderId,
    name: params.brandName,
    description: `Order #${params.orderId.slice(-6).toUpperCase()}`,
    prefill: params.prefill,
    themeColor: params.themeColor,
  });

  return apiFetch<Order>("/api/payments/razorpay/verify", {
    method: "POST",
    body: JSON.stringify({
      orderId: params.orderId,
      razorpayPaymentId: result.razorpay_payment_id,
      razorpayOrderId: result.razorpay_order_id,
      razorpaySignature: result.razorpay_signature,
    }),
  });
}
