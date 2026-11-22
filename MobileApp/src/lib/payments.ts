import * as WebBrowser from "expo-web-browser";
import { apiFetch } from "@/lib/api";
import type { PaymentChannel, PaymentStatusResult, RazorpayPaymentLink } from "@shared/types";

/**
 * Mobile online payments use a hosted Razorpay Payment Link because the
 * Checkout.js SDK is web-only. The link opens in the system browser; when the
 * customer returns we poll our backend, which reconciles against Razorpay even
 * if webhooks are not configured.
 */
export async function openPaymentLink(orderId: string, preferredMethod?: PaymentChannel) {
  const link = await apiFetch<RazorpayPaymentLink>("/api/payments/razorpay/link", {
    method: "POST",
    body: JSON.stringify({
      orderId,
      ...(preferredMethod && preferredMethod !== "COD" ? { preferredMethod } : {}),
    }),
  });
  await WebBrowser.openBrowserAsync(link.shortUrl, {
    showTitle: true,
    enableBarCollapsing: true,
  });
  return link;
}

export async function checkPaymentStatus(orderId: string) {
  return apiFetch<PaymentStatusResult>(`/api/payments/status/${orderId}`);
}

/** Poll until the gateway confirms the payment, or the window expires. */
export async function pollPaymentStatus(
  orderId: string,
  { attempts = 40, intervalMs = 3000 }: { attempts?: number; intervalMs?: number } = {}
): Promise<PaymentStatusResult | null> {
  let last: PaymentStatusResult | null = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    last = await checkPaymentStatus(orderId);
    if (last.paymentStatus === "PAID" || last.paymentStatus === "FAILED") return last;
    if (attempt < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
  return last;
}

/** Full mobile payment journey for an existing unpaid order. */
export async function payForOrder(orderId: string, preferredMethod?: PaymentChannel) {
  await openPaymentLink(orderId, preferredMethod);
  return pollPaymentStatus(orderId);
}
