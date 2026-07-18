import type { MetadataRoute } from "next";
import type { Category, Paginated, Product } from "@shared/types";
import { serverFetchOrNull, buildQuery } from "@/lib/server-api";
import { absoluteUrl } from "@/lib/site";

export const revalidate = 3600; // refresh the sitemap hourly

/** Dynamic sitemap: static pages + every category + product. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/products"), changeFrequency: "daily", priority: 0.9 },
  ];

  const [categories, products] = await Promise.all([
    serverFetchOrNull<Category[]>("/api/categories"),
    // Pull a large page of products for the sitemap (limit is capped at 60 server-side).
    serverFetchOrNull<Paginated<Product>>(`/api/products${buildQuery({ limit: 60, sort: "newest" })}`),
  ]);

  const categoryPages: MetadataRoute.Sitemap = (categories ?? []).map((c) => ({
    url: absoluteUrl(`/products?category=${c.slug}`),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const productPages: MetadataRoute.Sitemap = (products?.items ?? []).map((p) => ({
    url: absoluteUrl(`/products/${p.slug}`),
    lastModified: p.updatedAt ? new Date(p.updatedAt) : undefined,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticPages, ...categoryPages, ...productPages];
}
