"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Category } from "@shared/types";
import { Button } from "@/components/ui/Button";

type Filters = Record<string, string>;

const SORTS: { value: string; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "rating", label: "Top rated" },
  { value: "discount", label: "Biggest discount" },
];

/**
 * Catalog filter/sort bar. Receives the *current* query as plain props (so it
 * needs no useSearchParams / Suspense) and pushes a new URL on any change.
 */
export function ProductFilters({
  categories,
  current,
}: {
  categories: Category[];
  current: Filters;
}) {
  const router = useRouter();
  const [minPrice, setMinPrice] = useState(current.minPrice ?? "");
  const [maxPrice, setMaxPrice] = useState(current.maxPrice ?? "");

  /** Push /products with one key changed; always reset to page 1. */
  const apply = (changes: Filters) => {
    const next = { ...current, ...changes };
    delete next.page;
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) {
      if (v != null && String(v).trim() !== "") sp.set(k, String(v));
    }
    const qs = sp.toString();
    router.push(qs ? `/products?${qs}` : "/products");
  };

  const hasFilters =
    current.category || current.minPrice || current.maxPrice || current.availability || current.minRating;

  return (
    <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-slate-600">
          Sort
          <select
            value={current.sort ?? "newest"}
            onChange={(e) => apply({ sort: e.target.value })}
            className="ml-2 h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:border-brand"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium text-slate-600">
          Category
          <select
            value={current.category ?? ""}
            onChange={(e) => apply({ category: e.target.value })}
            className="ml-2 h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:border-brand"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium text-slate-600">
          Rating
          <select
            value={current.minRating ?? ""}
            onChange={(e) => apply({ minRating: e.target.value })}
            className="ml-2 h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:border-brand"
          >
            <option value="">Any</option>
            <option value="4">4★ & up</option>
            <option value="3">3★ & up</option>
          </select>
        </label>

        <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-600">
          <input
            type="checkbox"
            checked={current.availability === "in"}
            onChange={(e) => apply({ availability: e.target.checked ? "in" : "" })}
            className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
          />
          In stock only
        </label>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply({ minPrice, maxPrice });
        }}
        className="flex flex-wrap items-end gap-3"
      >
        <label className="text-sm font-medium text-slate-600">
          Min ₹
          <input
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            inputMode="numeric"
            placeholder="0"
            className="ml-2 h-10 w-24 rounded-lg border border-slate-200 px-2 text-sm outline-none focus:border-brand"
          />
        </label>
        <label className="text-sm font-medium text-slate-600">
          Max ₹
          <input
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            inputMode="numeric"
            placeholder="Any"
            className="ml-2 h-10 w-24 rounded-lg border border-slate-200 px-2 text-sm outline-none focus:border-brand"
          />
        </label>
        <Button type="submit" variant="outline" size="sm">
          Apply price
        </Button>
        {hasFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setMinPrice("");
              setMaxPrice("");
              apply({ category: "", minPrice: "", maxPrice: "", availability: "", minRating: "" });
            }}
          >
            Clear filters
          </Button>
        )}
      </form>
    </div>
  );
}
