import { DEFAULT_BRAND } from "@shared/constants";

/** Public site URL (no trailing slash). Used for SEO / canonical / OG tags. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** Default store name used in titles when the brand hasn't loaded server-side. */
export const SITE_NAME = DEFAULT_BRAND.appName;

export const SITE_DESCRIPTION =
  "Everything for Your Dream Home — Tiles, Paints, Electrical & Home Interiors. Quality building supplies with bulk pricing, delivered to your doorstep.";

/** Build an absolute URL from a site-relative path. */
export function absoluteUrl(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
