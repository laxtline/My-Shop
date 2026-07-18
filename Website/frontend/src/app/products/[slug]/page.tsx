import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { BrandConfig, Paginated, Product } from "@shared/types";
import { DEFAULT_BRAND } from "@shared/constants";
import { serverFetchOrNull, buildQuery } from "@/lib/server-api";
import { ProductGallery } from "@/components/storefront/ProductGallery";
import { ProductActions } from "@/components/storefront/ProductActions";
import { ProductReviews } from "@/components/storefront/ProductReviews";
import { RecentlyViewed } from "@/components/storefront/RecentlyViewed";
import { ProductCard } from "@/components/storefront/ProductCard";
import { Rating } from "@/components/ui/Rating";
import { Badge } from "@/components/ui/Badge";
import { categoryName, categorySlug } from "@/lib/format";
import { absoluteUrl } from "@/lib/site";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await serverFetchOrNull<Product>(`/api/products/${slug}`);
  if (!product) return { title: "Product not found" };

  const description =
    product.description?.slice(0, 160) ||
    `Buy ${product.title} at the best price. Quality building supplies with bulk pricing.`;
  const image = product.images?.[0];
  const url = `/products/${product.slug}`;

  return {
    title: product.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      title: product.title,
      description,
      url,
      images: image ? [{ url: image, alt: product.title }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: product.title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await serverFetchOrNull<Product>(`/api/products/${slug}`);
  if (!product) notFound();

  const catSlug = categorySlug(product.category);
  const [brand, related] = await Promise.all([
    serverFetchOrNull<BrandConfig>("/api/brand"),
    catSlug
      ? serverFetchOrNull<Paginated<Product>>(`/api/products${buildQuery({ category: catSlug, limit: 5 })}`)
      : Promise.resolve(null),
  ]);
  const supportPhone = (brand ?? DEFAULT_BRAND).supportPhone;
  const relatedItems = (related?.items ?? []).filter((p) => p.id !== product.id).slice(0, 4);
  const specs = Object.entries(product.specifications ?? {});

  // Product structured data (schema.org) for Google rich results.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description || product.title,
    image: product.images ?? [],
    sku: product.sku,
    brand: { "@type": "Brand", name: product.brand || (brand ?? DEFAULT_BRAND).appName },
    ...(product.numReviews > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.rating,
            reviewCount: product.numReviews,
          },
        }
      : {}),
    offers: {
      "@type": "Offer",
      priceCurrency: "INR",
      price: product.price,
      availability:
        product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: absoluteUrl(`/products/${product.slug}`),
    },
  };

  return (
    <div className="space-y-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Breadcrumb */}
      <nav className="text-sm text-slate-500" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-brand">
          Home
        </Link>
        <span className="mx-1.5">/</span>
        {catSlug ? (
          <Link href={`/products?category=${catSlug}`} className="hover:text-brand">
            {categoryName(product.category)}
          </Link>
        ) : (
          <Link href="/products" className="hover:text-brand">
            Products
          </Link>
        )}
        <span className="mx-1.5">/</span>
        <span className="text-slate-700">{product.title}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        <ProductGallery product={product} />

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-slate-400">{product.brand}</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{product.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Rating value={product.rating} count={product.numReviews} size="md" />
              <span className="text-xs text-slate-400">SKU: {product.sku}</span>
              {product.stock > 0 ? (
                <Badge tone="emerald">In stock</Badge>
              ) : (
                <Badge tone="red">Out of stock</Badge>
              )}
            </div>
          </div>

          <ProductActions product={product} supportPhone={supportPhone} />

          {product.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {product.tags.map((t) => (
                <Badge key={t} tone="slate">
                  #{t}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      {product.description && (
        <section>
          <h2 className="text-lg font-bold text-slate-900">Description</h2>
          <p className="mt-2 whitespace-pre-line leading-relaxed text-slate-600">{product.description}</p>
        </section>
      )}

      {/* Specifications */}
      {specs.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-slate-900">Specifications</h2>
          <dl className="mt-3 overflow-hidden rounded-2xl border border-slate-100">
            {specs.map(([k, v], i) => (
              <div
                key={k}
                className={i % 2 === 0 ? "flex bg-white" : "flex bg-slate-50"}
              >
                <dt className="w-1/3 px-4 py-3 text-sm font-medium text-slate-500">{k}</dt>
                <dd className="flex-1 px-4 py-3 text-sm text-slate-800">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* Reviews */}
      <ProductReviews productId={product.id} />

      {/* Recommended (related by category) */}
      {relatedItems.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-bold text-slate-900">You may also like</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {relatedItems.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* Recently viewed (client-side, from localStorage) */}
      <RecentlyViewed current={product} />
    </div>
  );
}
