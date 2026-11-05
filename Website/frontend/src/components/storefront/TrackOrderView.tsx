"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { formatINR } from "@/lib/format";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import type { OrderTracking, OrderStatus, OrderItem } from "@shared/types";

interface StatusStep {
  label: string;
  status: OrderStatus;
  completed: boolean;
  current: boolean;
  timestamp?: string;
  note?: string;
}

const STATUS_ORDER: OrderStatus[] = [
  "PLACED",
  "CONFIRMED",
  "PACKED",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

const STATUS_LABELS: Record<OrderStatus, string> = {
  PLACED: "Order Placed",
  CONFIRMED: "Confirmed",
  PACKED: "Packed",
  SHIPPED: "Shipped",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  // TODO: add PACKED/OUT_FOR_DELIVERY to OrderStatusBadge too
};

export function TrackOrderView({ orderId }: { orderId: string }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const [tracking, setTracking] = useState<OrderTracking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    apiFetch<OrderTracking>(`/api/orders/${orderId}/track`, { signal: controller.signal })
      .then((data) => {
        // console.log('[TrackOrderView] loaded:', data.orderId);
        setTracking(data);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err instanceof Error ? err.message : "Failed to load tracking");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [orderId]);

  if (loading) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error || !tracking) {
    return (
      <EmptyState
        icon="🚫"
        title="Tracking unavailable"
        message={error ?? "This order doesn't exist or you don't have access to it."}
        action={
          <Link href="/orders">
            <Button>My orders</Button>
          </Link>
        }
      />
    );
  }

  // Build status steps
  const steps: StatusStep[] = STATUS_ORDER.map((status) => {
    const historyEntry = tracking.statusHistory.find((h) => h.status === status);
    const completed = historyEntry !== undefined;
    const current = status === tracking.status && !["DELIVERED", "CANCELLED"].includes(tracking.status);
    return {
      label: STATUS_LABELS[status],
      status,
      completed,
      current,
      timestamp: historyEntry?.timestamp,
      note: historyEntry?.note,
    };
  });

  // Handle CANCELLED separately
  if (tracking.status === "CANCELLED") {
    steps.push({
      label: "Cancelled",
      status: "CANCELLED",
      completed: true,
      current: true,
      timestamp: tracking.statusHistory.find((h) => h.status === "CANCELLED")?.timestamp,
      note: tracking.statusHistory.find((h) => h.status === "CANCELLED")?.note,
    });
  }

  const formatDateTime = (iso?: string) => {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Track Order</h1>
          <p className="text-sm text-slate-500">Order #{orderId.slice(-8).toUpperCase()}</p>
        </div>
        <Link href="/orders" className="text-sm font-medium text-brand hover:underline">
          ← Back to orders
        </Link>
      </div>

      {/* Current Status Badge */}
      <div className="flex items-center gap-3 flex-wrap">
        <Badge tone={tracking.status === "DELIVERED" ? "emerald" : tracking.status === "CANCELLED" ? "red" : "brand"}>
          {STATUS_LABELS[tracking.status]}
        </Badge>
        {tracking.courier.name && (
          <Badge tone="slate">
            📦 {tracking.courier.name}
          </Badge>
        )}
        {tracking.courier.trackingId && (
          <Badge tone="slate">
            #{tracking.courier.trackingId}
          </Badge>
        )}
      </div>

      {/* Timeline */}
      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
        <h2 className="text-lg font-semibold text-slate-800">Order Timeline</h2>
        <div className="mt-4 relative">
          {/* Vertical line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-200" />
          {steps.map((step, index) => (
            <div key={step.status} className="relative pl-16 pb-8 last:pb-0">
              <div className="absolute left-0 top-1 flex h-10 w-10 items-center justify-center">
                <div
                  className={`relative rounded-full border-4 ${
                    step.completed || step.current
                      ? "border-brand bg-brand"
                      : "border-slate-200 bg-white"
                  } `}
                >
                  {step.completed && (
                    <span className="absolute -top-0.5 -left-0.5 flex h-6 w-6 items-center justify-center text-white text-xs">
                      ✓
                    </span>
                  )}
                  {step.current && !step.completed && (
                    <span className="absolute inset-0 rounded-full animate-ping bg-brand opacity-75" />
                  )}
                </div>
              </div>
              <div className="ml-2">
                <p className={`font-medium ${step.current ? "text-brand" : step.completed ? "text-slate-900" : "text-slate-500"}`}>
                  {step.label}
                </p>
                {step.timestamp && (
                  <p className="text-xs text-slate-400 mt-0.5">{formatDateTime(step.timestamp)}</p>
                )}
                {step.note && step.note !== `Status changed to ${step.status}` && (
                  <p className="text-xs text-slate-500 mt-0.5">{step.note}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Courier Tracking */}
      {tracking.courier.trackingId && (
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
          <h2 className="text-lg font-semibold text-slate-800">Courier Tracking</h2>
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-slate-700">Courier:</span>
              <span className="font-medium text-slate-900">{tracking.courier.name || "Not assigned"}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-slate-700">Tracking ID:</span>
              <code className="font-mono text-sm bg-slate-50 px-2 py-1 rounded">{tracking.courier.trackingId}</code>
              {tracking.trackingUrl && (
                <a
                  href={tracking.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-brand hover:underline flex items-center gap-1"
                >
                  Track on courier site →
                </a>
              )}
            </div>
            {tracking.trackingUrl && (
              <Button
                variant="outline"
                onClick={() => window.open(tracking.trackingUrl!, "_blank")}
                className="w-full sm:w-auto"
              >
                Open Courier Tracking Page
              </Button>
            )}
          </div>
        </section>
      )}

      {/* Shipping Address */}
      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
        <h2 className="text-lg font-semibold text-slate-800">Shipping Address</h2>
        <address className="mt-3 text-sm text-slate-600 not-italic">
          <p className="font-medium text-slate-900">{tracking.shippingAddress.fullName}</p>
          <p>{tracking.shippingAddress.phone}</p>
          <p>{tracking.shippingAddress.line1}</p>
          {tracking.shippingAddress.line2 && <p>{tracking.shippingAddress.line2}</p>}
          <p>{tracking.shippingAddress.city}, {tracking.shippingAddress.state} — {tracking.shippingAddress.pincode}</p>
        </address>
      </section>

      {/* Order Items */}
      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
        <h2 className="text-lg font-semibold text-slate-800">Order Items</h2>
        <ul className="mt-3 space-y-3">
          {tracking.items.map((item: OrderItem, index: number) => (
            <li key={index} className="flex gap-3">
              <div className="h-16 w-16 shrink-0 rounded-lg bg-slate-50" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 truncate">{item.title}</p>
                <p className="text-sm text-slate-500">Qty: {item.quantity} × {formatINR(item.unitPrice)}</p>
              </div>
              <p className="shrink-0 font-bold text-slate-900">{formatINR(item.lineTotal)}</p>
            </li>
          ))}
        </ul>
        <div className="mt-4 border-t border-slate-100 pt-4 text-right">
          <p className="text-base font-bold text-slate-900">Total: {formatINR(tracking.total)}</p>
        </div>
      </section>

      {/* Return Status */}
      {tracking.returnRequest && (
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
          <h2 className="text-lg font-semibold text-slate-800">Return Status</h2>
          <div className="mt-3 space-y-2">
            <p>
              <span className="font-medium text-slate-700">Status: </span>
              <Badge tone={tracking.returnRequest.status === "REFUNDED" ? "emerald" : "brand"}>
                {tracking.returnRequest.status}
              </Badge>
            </p>
            {tracking.returnRequest.reason && (
              <p>
                <span className="font-medium text-slate-700">Reason: </span>
                <span className="text-slate-600">{tracking.returnRequest.reason}</span>
              </p>
            )}
            {tracking.returnRequest.requestedAt && (
              <p className="text-sm text-slate-500">
                Requested on {new Date(tracking.returnRequest.requestedAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            )}
          </div>
        </section>
      )}

      {/* Refund Status */}
      {tracking.refund && tracking.refund.status !== "PENDING" && (
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
          <h2 className="text-lg font-semibold text-slate-800">Refund Status</h2>
          <div className="mt-3 space-y-2">
            <p>
              <span className="font-medium text-slate-700">Status: </span>
              <Badge tone={tracking.refund.status === "COMPLETED" ? "emerald" : "red"}>
                {tracking.refund.status}
              </Badge>
            </p>
            <p>
              <span className="font-medium text-slate-700">Amount: </span>
              <span className="font-bold text-slate-900">{formatINR(tracking.refund.amount)}</span>
            </p>
            <p>
              <span className="font-medium text-slate-700">Method: </span>
              <span className="text-slate-600">{tracking.refund.method}</span>
            </p>
          </div>
        </section>
      )}

      {/* Support */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-center">
        <p className="text-sm text-slate-600">
          Need help? Contact support at{" "}
          <a href={`tel:${tracking.shippingAddress.phone}`} className="text-brand hover:underline font-medium">
            {tracking.shippingAddress.phone}
          </a>
        </p>
      </div>
    </div>
  );
}