import type { Metadata } from "next";
import type { Product } from "@shared/types";
import { serverFetchOrNull, buildQuery } from "@/lib/server-api";
import { ProductCard } from "@/components/storefront/ProductCard";
import { SearchBar } from "@/components/storefront/SearchBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from '@/components/storefront/Pagination';

export const metadata: Metadata = {
  title: "Search",
  robots: { index: false, follow: true },
};

// Search results should reflect the latest query, not a cached page.
export const revalidate = 0;

interface SearchResponse {
  query: string;
  items: Product[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  nextCursor?: string | null;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim() ?? "";
  const cursor = typeof sp.cursor === 'string' ? sp.cursor : '';
  const page = typeof sp.page === 'string' ? sp.page : '1';

  const data = q
    ? await serverFetchOrNull<SearchResponse>(`/api/search${buildQuery({ q, limit: 24, cursor, page })}`, { revalidate: 0 })
    : null;
  const items = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Search</h1>
        <SearchBar className="mt-4 max-w-xl" initialQuery={q} autoFocus />
      </div>

      {!q ? (
        <EmptyState icon="🔎" title="What are you looking for?" message="Search across tiles, paints, electricals and interiors." />
      ) : items.length === 0 ? (
        <EmptyState
          icon="🔍"
          title={`No results for “${q}”`}
          message="Check the spelling or try a more general term."
        />
      ) : (
        <>
          <p className="text-sm text-slate-500">
            {data?.total} result{data?.total === 1 ? "" : "s"} for “{q}”
          </p>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          {data && <Pagination page={data.page} totalPages={data.totalPages} params={{ q, cursor, page }} basePath="/search" nextCursor={data.nextCursor} />}
        </>
      )}
    </div>
  );
}
