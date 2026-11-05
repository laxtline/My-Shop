import type { ApiResponse } from '@shared/types';

// Server-side data fetching for React Server Components (catalog pages).
// The catalog endpoints are public, so no auth/cookies are needed here.
// Results are cached and revalidated periodically for fast, SEO-friendly pages.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

// Default ISR window (seconds). Catalog data changes infrequently.
const DEFAULT_REVALIDATE = 60;

// Max time to wait for the backend, so a slow/unreachable API can never stall
// page rendering — callers fall back to their offline state instead.
const FETCH_TIMEOUT_MS = 8000;

// During `next build` the backend is usually not running (local CI, Vercel),
// so build-time prerenders skip the network entirely and render the offline
// fallback. Real data arrives at runtime via ISR (revalidate) on first request.
const IS_BUILD_PHASE = process.env.NEXT_PHASE === 'phase-production-build';

export async function serverFetch<T>(
  path: string,
  opts: { revalidate?: number; tags?: string[] } = {}
): Promise<T> {
  if (IS_BUILD_PHASE) {
    throw new ApiServerError(503, 'Skipping API calls during build; data loads at runtime via ISR.');
  }
  const res = await fetch(`${API_URL}${path}`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    next: {
      revalidate: opts.revalidate ?? DEFAULT_REVALIDATE,
      tags: opts.tags,
    },
  });

  let body: ApiResponse<T> | null = null;
  try {
    body = (await res.json()) as ApiResponse<T>;
  } catch {
    /* non-JSON response */
  }

  if (!res.ok || !body?.success) {
    throw new ApiServerError(res.status, body?.message ?? `Request failed (${res.status})`);
  }
  return body.data as T;
}

// Same as serverFetch but returns null instead of throwing on 404 / failure.
export async function serverFetchOrNull<T>(
  path: string,
  opts: { revalidate?: number; tags?: string[] } = {}
): Promise<T | null> {
  try {
    return await serverFetch<T>(path, opts);
  } catch {
    return null;
  }
}

export class ApiServerError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiServerError';
  }
}

// Build a querystring from a params object, skipping empty values.
export function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      sp.set(k, String(v));
    }
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export { API_URL };
