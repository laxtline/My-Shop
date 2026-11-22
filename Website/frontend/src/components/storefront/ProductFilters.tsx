"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Category, Paginated } from "@shared/types";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/Button";

type Filters = Record<string, string>;

const SORTS: { value: string; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "rating", label: "Top rated" },
  { value: "discount", label: "Biggest discount" },
];

/** "home-interiors" → "Home Interiors" for a slug we haven't fetched yet. */
function prettySlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Compact category dropdown, styled like the Sort/Rating selects. The category
 * list (and its search box) only renders after the trigger is clicked, so the
 * filter bar stays short until the shopper asks for it.
 */
function CategoryFilter({
  selected,
  selectedName,
  onSelect,
}: {
  selected: string;
  selectedName?: string;
  onSelect: (slug: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<{ slug: string; name: string }[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close the panel on an outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Focus the search box as soon as the panel opens.
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  // Fetch categories only while the panel is open, debounced while typing.
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      setError("");
      apiFetch<Paginated<Category>>(
        `/api/categories?${new URLSearchParams({ q: query, limit: "20" })}`,
        { signal: controller.signal }
      )
        .then((data) => {
          const items = data.items.map((category) => ({ slug: category.slug, name: category.name }));
          setRows(items);
          setLabels((current) => ({
            ...current,
            ...Object.fromEntries(items.map((item) => [item.slug, item.name])),
          }));
        })
        .catch((err) => {
          if (!controller.signal.aborted) {
            setError(err instanceof Error ? err.message : "Could not load categories.");
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, query]);

  const label = selected ? selectedName ?? labels[selected] ?? prettySlug(selected) : "All categories";

  const toggle = () => {
    if (!open) setQuery("");
    setOpen((value) => !value);
  };

  const choose = (slug: string) => {
    onSelect(slug);
    setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative text-sm font-medium text-slate-600">
      <span>Category</span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggle}
        className="ml-2 inline-flex h-10 min-w-44 max-w-60 items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-900 outline-none transition hover:border-slate-300 focus:border-brand"
      >
        <span className="truncate">{label}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search categories…"
            aria-label="Search categories"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <ul role="listbox" aria-label="Categories" className="mt-2 max-h-64 overflow-auto">
            <li>
              <button
                type="button"
                role="option"
                aria-selected={!selected}
                onClick={() => choose("")}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm ${
                  !selected ? "bg-brand-50 font-semibold text-brand" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span>All categories</span>
                {!selected && <span aria-hidden="true">✓</span>}
              </button>
            </li>
            {rows.map((category) => {
              const active = selected === category.slug;
              return (
                <li key={category.slug}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => choose(category.slug)}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm ${
                      active ? "bg-brand-50 font-semibold text-brand" : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span className="truncate">{category.name}</span>
                    {active && <span aria-hidden="true">✓</span>}
                  </button>
                </li>
              );
            })}
          </ul>
          {loading && <p role="status" className="px-2 pt-2 text-xs text-slate-500">Searching…</p>}
          {!loading && !rows.length && <p className="px-2 py-3 text-xs text-slate-500">No categories found.</p>}
          {error && <p role="alert" className="px-2 py-2 text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}

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

  // Sync local state with URL props when they change (e.g., browser back/forward)
  useEffect(() => {
    setMinPrice(current.minPrice ?? "");
    setMaxPrice(current.maxPrice ?? "");
  }, [current.minPrice, current.maxPrice]);

  /** Push /products with one key changed; always reset to page 1. */
  const apply = (changes: Filters) => {
    const next = { ...current, ...changes };
    delete next.page;
    delete next.cursor;
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) {
      if (v != null && String(v).trim() !== "") sp.set(k, String(v));
    }
    const qs = sp.toString();
    router.push(qs ? `/products?${qs}` : "/products");
  };

  const hasFilters =
    current.category || current.minPrice || current.maxPrice || current.availability || current.minRating;
  const activeCategory = current.category
    ? categories.find((category) => category.slug === current.category)
    : undefined;

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

        <CategoryFilter
          selected={current.category ?? ""}
          selectedName={activeCategory?.name}
          onSelect={(slug) => apply({ category: slug })}
        />

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
