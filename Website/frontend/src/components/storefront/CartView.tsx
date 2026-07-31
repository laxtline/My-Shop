"use client";

import Link from "next/link";
import { useEffect } from "react";
import type { Product } from "@shared/types";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchCart, updateCartItem, removeFromCart } from "@/store/cartSlice";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { formatINR, unitPriceForQty, primaryImage } from "@/lib/format";

/** Interactive cart: quantity steppers, remove, live totals and WhatsApp checkout. */
export function CartView() {
  const dispatch = useAppDispatch();
  const { cart, status, mutating } = useAppSelector((s) => s.cart);
  const brand = useAppSelector((s) => s.brand.brand);

  useEffect(() => {
    if (status === "idle") dispatch(fetchCart());
  }, [status, dispatch]);

  // Only populated products can be priced/rendered. `product` is null when the
  // referenced product was deleted, so check for that too — `typeof null` is "object".
  const lines = (cart?.items ?? [])
    .map((it) => ({ product: it.product, quantity: it.quantity }))
    .filter((l): l is { product: Product; quantity: number } => !!l.product && typeof l.product !== "string");

  if (status === "loading" && !cart) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!lines.length) {
    return (
      <EmptyState
        icon="🛒"
        title="Your cart is empty"
        message="Browse the catalogue and add items to get started."
        action={
          <Link href="/products">
            <Button>Start shopping</Button>
          </Link>
        }
      />
    );
  }

  const subtotal = lines.reduce((sum, l) => sum + unitPriceForQty(l.product, l.quantity) * l.quantity, 0);
  const mrpTotal = lines.reduce((sum, l) => sum + l.product.mrp * l.quantity, 0);
  const savings = Math.max(0, mrpTotal - subtotal);
  const totalUnits = lines.reduce((sum, l) => sum + l.quantity, 0);

  const orderText = encodeURIComponent(
    `Hi! I'd like to place an order:\n\n` +
      lines.map((l) => `• ${l.product.title} × ${l.quantity} — ${formatINR(unitPriceForQty(l.product, l.quantity) * l.quantity)}`).join("\n") +
      `\n\nTotal: ${formatINR(subtotal)} (${totalUnits} items)`
  );
  const waLink = `https://wa.me/91${brand.supportPhone}?text=${orderText}`;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <ul className="space-y-3">
        {lines.map(({ product, quantity }) => {
          const unit = unitPriceForQty(product, quantity);
          const busy = mutating === product.id;
          const max = Math.max(1, product.stock);
          return (
            <li
              key={product.id}
              className="flex gap-4 rounded-2xl border border-slate-100 bg-white p-3 shadow-card"
            >
              <Link href={`/products/${product.slug}`} className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={primaryImage(product)}
                  alt={product.title}
                  className="h-24 w-24 rounded-xl bg-slate-50 object-cover"
                />
              </Link>

              <div className="flex flex-1 flex-col">
                <Link
                  href={`/products/${product.slug}`}
                  className="line-clamp-2 text-sm font-semibold text-slate-800 hover:text-brand"
                >
                  {product.title}
                </Link>
                <p className="mt-0.5 text-xs text-slate-400">{product.brand}</p>
                <p className="mt-1 text-sm font-bold text-slate-900">
                  {formatINR(unit)}
                  <span className="ml-1 text-xs font-normal text-slate-400">/ unit</span>
                </p>

                <div className="mt-auto flex items-center gap-3 pt-2">
                  <div className="inline-flex items-center rounded-lg border border-slate-300">
                    <button
                      onClick={() => dispatch(updateCartItem({ productId: product.id, quantity: quantity - 1 }))}
                      disabled={busy}
                      className="grid h-9 w-9 place-items-center text-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>
                    <span className="grid h-9 w-10 place-items-center border-x border-slate-300 text-sm font-semibold">
                      {quantity}
                    </span>
                    <button
                      onClick={() => dispatch(updateCartItem({ productId: product.id, quantity: Math.min(max, quantity + 1) }))}
                      disabled={busy || quantity >= max}
                      className="grid h-9 w-9 place-items-center text-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>

                  <button
                    onClick={() => dispatch(removeFromCart(product.id))}
                    disabled={busy}
                    className="text-sm font-medium text-red-600 hover:underline disabled:opacity-40"
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-sm font-bold text-slate-900">{formatINR(unit * quantity)}</p>
                {busy && <Spinner className="mt-2 h-4 w-4" />}
              </div>
            </li>
          );
        })}
      </ul>

      <aside className="h-fit rounded-2xl border border-slate-100 bg-white p-5 shadow-card lg:sticky lg:top-24">
        <h2 className="text-base font-semibold text-slate-800">Order summary</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between text-slate-600">
            <dt>Items ({totalUnits})</dt>
            <dd>{formatINR(subtotal)}</dd>
          </div>
          {savings > 0 && (
            <div className="flex justify-between text-emerald-600">
              <dt>You save</dt>
              <dd>−{formatINR(savings)}</dd>
            </div>
          )}
          <div className="flex justify-between text-slate-600">
            <dt>Delivery</dt>
            <dd>Calculated at order</dd>
          </div>
          <div className="mt-2 flex justify-between border-t border-slate-100 pt-3 text-base font-bold text-slate-900">
            <dt>Total</dt>
            <dd>{formatINR(subtotal)}</dd>
          </div>
        </dl>

        <Link
          href="/checkout"
          className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand font-semibold text-white transition-colors hover:bg-brand-700 focus-ring"
        >
          Proceed to checkout
        </Link>
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-600 font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 focus-ring"
        >
          💬 Or order on WhatsApp
        </a>
        <Link href="/products" className="mt-3 block text-center text-sm font-medium text-brand hover:underline">
          Continue shopping
        </Link>
        <p className="mt-3 text-center text-xs text-slate-400">
          Prices include GST. Bulk discounts applied automatically.
        </p>
      </aside>
    </div>
  );
}
