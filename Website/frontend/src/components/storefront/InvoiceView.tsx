"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchOrder } from "@/store/ordersSlice";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatINR } from "@/lib/format";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export function InvoiceView({ id }: { id: string }) {
  return (
    <ProtectedRoute fallback={<SignInPrompt />}>
      <Invoice id={id} />
    </ProtectedRoute>
  );
}

function SignInPrompt() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
      <p className="text-slate-600">Please sign in to view this invoice.</p>
      <Link href="/" className="mt-3 inline-block font-medium text-brand hover:underline">
        Go home
      </Link>
    </div>
  );
}

function Invoice({ id }: { id: string }) {
  const dispatch = useAppDispatch();
  const { current, currentStatus } = useAppSelector((s) => s.orders);
  const brand = useAppSelector((s) => s.brand.brand);

  useEffect(() => {
    dispatch(fetchOrder(id));
  }, [id, dispatch]);

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
        title="Invoice unavailable"
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
  const addr = order.shippingAddress;
  const invoiceNo = order.id.slice(-8).toUpperCase();
  const date = order.createdAt
    ? new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
    : "";

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Actions (hidden when printing) */}
      <div className="no-print flex items-center justify-between">
        <Link href={`/orders/${order.id}`} className="text-sm font-medium text-brand hover:underline">
          ← Back to order
        </Link>
        <Button size="sm" onClick={() => window.print()}>
          🖨️ Print / Save as PDF
        </Button>
      </div>

      {/* Invoice */}
      <div className="print-area rounded-2xl border border-slate-200 bg-white p-8 shadow-card">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-6">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={brand.logoUrl} alt="" className="h-12 w-12 rounded-lg object-contain" />
            <div>
              <p className="text-lg font-bold text-slate-900">{brand.appName}</p>
              <p className="text-xs text-slate-500">{brand.tagline}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-slate-900">TAX INVOICE</p>
            <p className="text-xs text-slate-500">#{invoiceNo}</p>
            <p className="text-xs text-slate-500">{date}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 py-6 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Billed to</p>
            <p className="mt-1 font-medium text-slate-800">{addr.fullName}</p>
            <p className="text-slate-600">
              {addr.line1}
              {addr.line2 ? `, ${addr.line2}` : ""}
            </p>
            <p className="text-slate-600">
              {addr.city}, {addr.state} — {addr.pincode}
            </p>
            <p className="text-slate-600">📞 {addr.phone}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Seller</p>
            <p className="mt-1 font-medium text-slate-800">{brand.appName}</p>
            {brand.supportPhone && <p className="text-slate-600">📞 {brand.supportPhone}</p>}
            {brand.supportEmail && <p className="text-slate-600">✉️ {brand.supportEmail}</p>}
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="py-2 font-medium">Item</th>
              <th className="py-2 text-center font-medium">Qty</th>
              <th className="py-2 text-right font-medium">Unit</th>
              <th className="py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((it, i) => (
              <tr key={i} className="border-b border-slate-50">
                <td className="py-2">
                  <span className="font-medium text-slate-800">{it.title}</span>
                  {it.sku && <span className="block text-xs text-slate-400">SKU: {it.sku}</span>}
                </td>
                <td className="py-2 text-center text-slate-600">{it.quantity}</td>
                <td className="py-2 text-right text-slate-600">{formatINR(it.unitPrice)}</td>
                <td className="py-2 text-right font-medium text-slate-800">{formatINR(it.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex justify-end">
          <dl className="w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between text-slate-600">
              <dt>Items total</dt>
              <dd>{formatINR(order.itemsTotal)}</dd>
            </div>
            <div className="flex justify-between text-slate-600">
              <dt>Delivery</dt>
              <dd>{order.deliveryFee === 0 ? "FREE" : formatINR(order.deliveryFee)}</dd>
            </div>
            {!!order.discount && order.discount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <dt>Discount{order.couponCode ? ` (${order.couponCode})` : ""}</dt>
                <dd>−{formatINR(order.discount)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-200 pt-1 text-base font-bold text-slate-900">
              <dt>Grand total</dt>
              <dd>{formatINR(order.total)}</dd>
            </div>
          </dl>
        </div>

        <div className="mt-6 border-t border-slate-100 pt-4 text-xs text-slate-500">
          <p>
            Payment: {order.paymentMethod === "COD" ? "Cash on Delivery" : "Online (Razorpay)"} ·{" "}
            <span className="uppercase">{order.paymentStatus}</span>
          </p>
          <p className="mt-1">Prices are inclusive of GST. This is a computer-generated invoice.</p>
          <p className="mt-3 font-medium text-slate-600">Thank you for shopping with {brand.appName}!</p>
        </div>
      </div>
    </div>
  );
}
