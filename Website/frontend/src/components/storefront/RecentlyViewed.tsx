"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Product } from "@shared/types";
import { Price } from "@/components/ui/Price";
import { primaryImage } from "@/lib/format";
import {
  getRecentlyViewed,
  recordRecentlyViewed,
  type RecentProduct,
} from "@/lib/recentlyViewed";

/**
 * Records the given product as recently-viewed and renders a rail of the
 * previously-viewed ones (excluding the current product). Client-only, backed
 * by localStorage — no API call needed.
 */
export function RecentlyViewed({ current }: { current: Product }) {
  const [items, setItems] = useState<RecentProduct[]>([]);

  useEffect(() => {
    // Read the prior list first (before adding the current product to storage).
    setItems(getRecentlyViewed().filter((p) => p.id !== current.id).slice(0, 6));
    recordRecentlyViewed({
      id: current.id,
      slug: current.slug,
      title: current.title,
      image: primaryImage(current),
      price: current.price,
      mrp: current.mrp,
    });
  }, [current.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (items.length === 0) return null;

  return (
    <section>
      <h2 className="mb-4 text-lg font-bold text-slate-900">Recently viewed</h2>
      <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">
        {items.map((p) => (
          <Link
            key={p.id}
            href={`/products/${p.slug}`}
            className="w-40 shrink-0 rounded-2xl border border-slate-100 bg-white p-3 shadow-card transition-shadow hover:shadow-card-hover"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.image}
              alt={p.title}
              className="aspect-square w-full rounded-xl bg-slate-50 object-cover"
            />
            <p className="mt-2 line-clamp-2 text-sm font-semibold text-slate-800">{p.title}</p>
            <Price price={p.price} mrp={p.mrp} size="sm" className="mt-1" />
          </Link>
        ))}
      </div>
    </section>
  );
}
