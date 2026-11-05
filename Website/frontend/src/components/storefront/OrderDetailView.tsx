"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchOrder, cancelOrder } from "@/store/ordersSlice";
import { payForOrder } from "@/lib/razorpay";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { formatINR, PLACEHOLDER_IMAGE } from "@/lib/format";
import { ProtectedRoute } from "@/components/ProtectedRoute";

const CANCELLABLE = ["PLACED", "CONFIRMED"];

export function OrderDetailView({ id }: { id: string }) {
  return (
    <ProtectedRoute fallback={<SignInPrompt />}>
      <OrderDetail id={id} />
    </ProtectedRoute>
  );
}

function SignInPrompt() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
      <p className="text-slate-600">Please sign in to view this order.</p>
      <Link href="/" className="mt-3 inline-block font-medium text-brand hover:underline">
        Go home
      </Link>
    </div>
  );
}

function OrderDetail({ id }: { id: string }) {
  const dispatch = useAppDispatch();
  const { current, currentStatus } = useAppSelector((s) => s.orders);
  const brand = useAppSelector((s) => s.brand.brand);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  useEffect(() => {
    dispatch(fetchOrder(id));
  }, [id, dispatch]);

  const retryPayment = async () => {
    setPayError(null);
    setPaying(true);
    try {
      await payForOrder({
        orderId: id,
        brandName: brand.appName,
        themeColor: brand.themeColor,
      });
      dispatch(fetchOrder(id)); // refresh to show PAID
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "Payment could not be completed.");
    } finally {
      setPaying(false);
    }
  };

  if (currentStatus === "loading" || (!current && currentStatus !== "error")) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (currentStatus === "error" || !current) {
    return (
      <EmptyState
        icon="🚫"
        title="Order not found"
        message="This order doesn't exist or you don't have access to it."
        action={
          <Link href="/orders">
            <Button>My orders</Button>
          </Link>
        }
      />
    );
  }

  const order = current;
  const needsPayment =
    order.paymentMethod === "RAZORPAY" &&
    order.paymentStatus !== "PAID" &&
    order.status !== "CANCELLED";
  const placed = order.createdAt
    ? new Date(order.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : "";
  const addr = order.shippingAddress;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Order #{order.id.slice(-6).toUpperCase()}</h1>
          <p className="mt-1 text-sm text-slate-500">Placed {placed}</p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      {order.status !== "CANCELLED" && (
        <StatusTimeline status={order.status} />
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
          <h2 className="text-base font-semibold text-slate-800">Items</h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {order.items.map((it, i) => (
              <li key={i} className="flex gap-3 py-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={it.image || PLACEHOLDER_IMAGE}
                  alt={it.title}
                  className="h-16 w-16 rounded-lg bg-slate-50 object-cover"
                />
                <div className="flex-1">
                  <p className="line-clamp-2 text-sm font-medium text-slate-800">{it.title}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {formatINR(it.unitPrice)} × {it.quantity}
                  </p>
                </div>
                <span className="text-sm font-semibold text-slate-900">{formatINR(it.lineTotal)}</span>
              </li>
            ))}
          </ul>
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
            <h2 className="text-base font-semibold text-slate-800">Summary</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <dt>Items total</dt>
                <dd>{formatINR(order.itemsTotal)}</dd>
              </div>
              <div className="flex justify-between text-slate-600">
                <dt>Delivery</dt>
                <dd>{order.deliveryFee === 0 ? "FREE" : formatINR(order.deliveryFee)}</dd>
              </div>
              {!!order.discount && order.discount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <dt>Discount{order.couponCode ? ` (${order.couponCode})` : ""}</dt>
                  <dd>−{formatINR(order.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-bold text-slate-900">
                <dt>Total</dt>
                <dd>{formatINR(order.total)}</dd>
              </div>
            </dl>
            <div className="mt-3 flex items-center gap-2 text-xs">
              <span className="text-slate-400">
                {order.paymentMethod === "COD" ? "Cash on Delivery" : "Online payment"}
              </span>
              <PaymentBadge status={order.paymentStatus} />
            </div>

            {needsPayment && (
              <div className="mt-3">
                <Button fullWidth loading={paying} onClick={retryPayment}>
                  Pay now · {formatINR(order.total)}
                </Button>
                {payError && <p className="mt-2 text-xs text-red-600">{payError}</p>}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
            <h2 className="text-base font-semibold text-slate-800">Delivery address</h2>
            <address className="mt-2 text-sm not-italic leading-relaxed text-slate-600">
              {addr.fullName}
              <br />
              {addr.line1}
              {addr.line2 ? `, ${addr.line2}` : ""}
              <br />
              {addr.city}, {addr.state} — {addr.pincode}
              <br />
              📞 {addr.phone}
            </address>
          </div>

          {CANCELLABLE.includes(order.status) && (
            <Button
              variant="danger"
              fullWidth
              onClick={() => {
                if (confirm("Cancel this order?")) dispatch(cancelOrder(order.id));
              }}
            >
              Cancel order
            </Button>
          )}
          <Link href={`/orders/${order.id}/invoice`}>
            <Button variant="outline" fullWidth>
              🧾 View / print invoice
            </Button>
          </Link>
          <Link href="/orders" className="block text-center text-sm font-medium text-brand hover:underline">
            ← All orders
          </Link>
        </aside>
      </div>
    </div>
  );
}

function PaymentBadge({ status }: { status: string }) {
  if (status === "PAID") return <Badge tone="emerald">Paid</Badge>;
  if (status === "FAILED") return <Badge tone="red">Payment failed</Badge>;
  return <Badge tone="amber">Payment pending</Badge>;
}

const STEPS = ["PLACED", "CONFIRMED", "SHIPPED", "DELIVERED"] as const;

function StatusTimeline({ status }: { status: string }) {
  const activeIndex = STEPS.indexOf(status as (typeof STEPS)[number]);
  return (
    <ol className="flex items-center">
      {STEPS.map((step, i) => {
        const done = i <= activeIndex;
        return (
          <li key={step} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center">
              <span
                className={`grid h-8 w-8 place-items-center rounded-full text-sm font-bold ${
                  done ? "bg-brand text-white" : "bg-slate-200 text-slate-400"
                }`}
              >
                {i + 1}
              </span>
              <span className={`mt-1 text-[11px] ${done ? "text-slate-700" : "text-slate-400"}`}>
                {step.charAt(0) + step.slice(1).toLowerCase()}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`mx-1 h-0.5 flex-1 ${i < activeIndex ? "bg-brand" : "bg-slate-200"}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
