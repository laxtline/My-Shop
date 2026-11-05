import Link from "next/link";
import type { BrandConfig, Category, Paginated, Product } from "@shared/types";
import { DEFAULT_BRAND } from "@shared/constants";
import { serverFetchOrNull, buildQuery } from "@/lib/server-api";
import { ProductCard } from "@/components/storefront/ProductCard";
import { Button } from "@/components/ui/Button";

export const revalidate = 60;

const CATEGORY_EMOJI: Record<string, string> = {
  tiles: "🧱",
  paints: "🎨",
  electrical: "💡",
  "home-interiors": "🛋️",
};

/** Storefront home: hero, category shortcuts, top deals and new arrivals. */
export default async function HomePage() {
  const [brand, categories, newest, deals] = await Promise.all([
    serverFetchOrNull<BrandConfig>("/api/brand"),
    serverFetchOrNull<Paginated<Category>>("/api/categories?limit=8&sort=order"),
    serverFetchOrNull<Paginated<Product>>(`/api/products${buildQuery({ sort: "newest", limit: 8 })}`),
    serverFetchOrNull<Paginated<Product>>(`/api/products${buildQuery({ sort: "discount", limit: 8 })}`),
  ]);
  const b = brand ?? DEFAULT_BRAND;
  const offline = !newest && !deals;

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 px-6 py-12 text-white sm:px-10 sm:py-16">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-100">{b.appName}</p>
        <h1 className="mt-2 max-w-2xl text-3xl font-bold leading-tight sm:text-4xl">
          {b.tagline}
        </h1>
        <p className="mt-3 max-w-xl text-brand-100">
          Tiles, paints, electricals and interiors — quality building supplies with bulk pricing,
          delivered to your doorstep.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/products">
            {/* bg-white is kept so the dark-mode remap in globals.css still turns
                this button's surface dark. The label was inheriting the variant's
                white text, which is invisible on the light surface — hence dark
                text in light mode, white text once the surface goes dark. */}
            <Button
              size="lg"
              className="bg-white !text-slate-900 hover:bg-brand-50 dark:!text-white"
            >
              Shop all products
            </Button>
          </Link>
          <Link href="/products?sort=discount">
            <Button size="lg" variant="outline" className="border-white/60 bg-transparent !text-white hover:bg-white/10">
              View today&apos;s deals
            </Button>
          </Link>
        </div>
      </section>

      {offline && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Catalogue data isn&apos;t loading yet. Make sure the backend API is running and seeded
          (<code>npm run seed</code>), then refresh.
        </div>
      )}

      {/* Categories */}
      {categories && categories.items.length > 0 && (
        <section>
          <SectionHeading title="Shop by category" href="/categories" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {categories.items.map((c) => (
              <Link
                key={c.id}
                href={`/products?category=${c.slug}`}
                className="group flex flex-col items-center gap-2 rounded-2xl border border-slate-100 bg-white p-6 text-center shadow-card transition-shadow hover:shadow-card-hover"
              >
                <span className="text-4xl transition-transform group-hover:scale-110" aria-hidden>
                  {CATEGORY_EMOJI[c.slug] ?? "🏷️"}
                </span>
                <span className="text-sm font-semibold text-slate-700">{c.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Top deals */}
      {deals && deals.items.length > 0 && (
        <section>
          <SectionHeading title="🔥 Top deals" href="/products?sort=discount" />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {deals.items.slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* New arrivals */}
      {newest && newest.items.length > 0 && (
        <section>
          <SectionHeading title="✨ New arrivals" href="/products?sort=newest" />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {newest.items.slice(0, 8).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SectionHeading({ title, href }: { title: string; href: string }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-xl font-bold text-slate-900">{title}</h2>
      <Link href={href} className="text-sm font-semibold text-brand hover:underline">
        View all →
      </Link>
    </div>
  );
}
