"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

/**
 * Global product search. Navigates to /search?q=… on submit.
 * Kept free of useSearchParams so it can live in the shared header without a
 * Suspense boundary; the /search page seeds its own copy via `initialQuery`.
 */
export function SearchBar({
  className,
  initialQuery = "",
  autoFocus = false,
}: {
  className?: string;
  initialQuery?: string;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const query = q.trim();
    router.push(query ? `/search?q=${encodeURIComponent(query)}` : "/search");
  };

  return (
    <form onSubmit={submit} className={className} role="search">
      <div className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 transition-colors focus-within:border-brand focus-within:bg-white">
        <span className="text-slate-400" aria-hidden>
          🔍
        </span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search tiles, paints, wiring…"
          className="h-full w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
          aria-label="Search products"
          autoFocus={autoFocus}
        />
      </div>
    </form>
  );
}
