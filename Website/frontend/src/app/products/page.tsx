import type { Metadata } from "next";
import type { Category, Paginated, Product } from "@shared/types";
import { serverFetchOrNull, buildQuery } from "@/lib/server-api";
import { ProductCard } from "@/components/storefront/ProductCard";
import { ProductFilters } from "@/components/storefront/ProductFilters";
import { Pagination } from "@/components/storefront/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";

export const revalidate = 60;

type SearchParams = Record<string, string | string[] | undefined>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const catSlug = Array.isArray(sp.category) ? sp.category[0] : sp.category;
  if (catSlug) {
    const categories = await serverFetchOrNull<Category[]>("/api/categories");
    const cat = categories?.find((c) => c.slug === catSlug);
    if (cat) {
      return {
        title: cat.name,
        description: `Shop ${cat.name} — quality products at the best prices with bulk pricing and fast delivery.`,
        alternates: { canonical: `/products?category=${cat.slug}` },
      };
    }
  }
  return {
    title: "All Products",
    description: "Browse all tiles, paints, electrical and home-interior products.",
    alternates: { canonical: "/products" },
  };
}

const FILTER_KEYS = ["category", "sort", "minPrice", "maxPrice", "minRating", "availability", "page"] as const;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  const params: Record<string, string> = {};
  for (const key of FILTER_KEYS) {
    const v = first(sp[key]);
    if (v) params[key] = v;
  }

  const query = buildQuery({ ...params, limit: 12 });

  const [categories, data] = await Promise.all([
    serverFetchOrNull<Category[]>("/api/categories"),
    serverFetchOrNull<Paginated<Product>>(`/api/products${query}`),
  ]);

  const items = data?.items ?? [];
  const activeCat = categories?.find((c) => c.slug === params.category);
  const title = activeCat ? activeCat.name : "All products";

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {data && (
          <p className="text-sm text-slate-500">
            {data.total} {data.total === 1 ? "product" : "products"}
          </p>
        )}
      </div>

      <ProductFilters categories={categories ?? []} current={params} />

      {items.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="No products match your filters"
          message="Try widening your price range or clearing filters."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          {data && (
            <Pagination page={data.page} totalPages={data.totalPages} params={params} />
          )}
        </>
      )}
    </div>
  );
}
