"use client";

import { useState } from "react";
import type { Product } from "@shared/types";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { addToCart, selectIsInCart } from "@/store/cartSlice";
import { useAuthAction } from "@/components/auth/AuthActionProvider";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { WishlistButton } from "./WishlistButton";
import { formatINR, unitPriceForQty, nextBulkTier } from "@/lib/format";
import { QuantitySelector } from '@/components/ui/QuantitySelector';

/** Quantity picker + add-to-cart + wishlist + WhatsApp order for the detail page. */
export function ProductActions({ product, supportPhone }: { product: Product; supportPhone: string }) {
  const dispatch = useAppDispatch();
  const { requireAuth } = useAuthAction();
  const { toast } = useToast();
  const inCart = useAppSelector(selectIsInCart(product.id));
  const mutating = useAppSelector((s) => s.cart.mutating === product.id);
  const [qty, setQty] = useState(1);

  const outOfStock = product.stock <= 0;
  const max = Math.max(1, product.stock);
  const unit = unitPriceForQty(product, qty);
  const upcoming = nextBulkTier(product.bulkPricing, qty);
  const lineTotal = unit * qty;

  const add = () =>
    requireAuth(async () => {
      const result = await dispatch(addToCart({ productId: product.id, quantity: qty }));
      if (addToCart.fulfilled.match(result)) {
        toast(`${qty} × ${product.title} added to cart`);
      } else {
        toast("Could not add to cart. Please try again.", "error");
      }
    }, "Sign in to add items to your cart");

  const waText = encodeURIComponent(
    `Hi! I'd like to order:\n• ${product.title}\n• Qty: ${qty}\n• SKU: ${product.sku}\n• Approx: ${formatINR(lineTotal)}`
  );
  const waLink = `https://wa.me/91${supportPhone}?text=${waText}`;

  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-3">
        <span className="text-3xl font-bold text-slate-900">{formatINR(unit)}</span>
        {product.mrp > unit && (
          <span className="text-base text-slate-400 line-through">{formatINR(product.mrp)}</span>
        )}
        <span className="text-sm text-slate-400">/ unit · incl. {product.gstRate}% GST</span>
      </div>

      {product.bulkPricing.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bulk pricing</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {product.bulkPricing.map((t) => (
              <li key={t.minQty}>
                <Badge tone={qty >= t.minQty ? "emerald" : "slate"}>
                  {t.minQty}+ → {formatINR(t.pricePerUnit)}
                </Badge>
              </li>
            ))}
          </ul>
          {upcoming && (
            <p className="mt-2 text-xs text-slate-500">
              Add {upcoming.minQty - qty} more to pay {formatINR(upcoming.pricePerUnit)}/unit.
            </p>
          )}
        </div>
      )}

      {outOfStock ? (
        <Badge tone="red" className="px-3 py-2">
          Currently out of stock
        </Badge>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <QuantitySelector value={qty} max={product.stock} onChange={setQty} />
            <span className="text-sm text-slate-500">
              {product.stock} in stock · Total <strong className="text-slate-800">{formatINR(lineTotal)}</strong>
            </span>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button size="lg" loading={mutating} onClick={add} className="flex-1">
              {inCart ? "In cart · Add more" : "Add to cart"}
            </Button>
            <WishlistButton productId={product.id} size="lg" className="border border-slate-200" />
          </div>

          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 font-semibold text-white transition-colors hover:bg-emerald-700 focus-ring"
          >
            💬 Order on WhatsApp
          </a>
        </>
      )}
    </div>
  );
}
