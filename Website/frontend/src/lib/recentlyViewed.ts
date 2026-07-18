"use client";

/** Minimal product snapshot stored locally so the rail renders without a refetch. */
export interface RecentProduct {
  id: string;
  slug: string;
  title: string;
  image: string;
  price: number;
  mrp: number;
}

const KEY = "rt-recently-viewed";
const MAX = 10;

/** Record a product view at the front of the recently-viewed list. */
export function recordRecentlyViewed(p: RecentProduct): void {
  if (typeof window === "undefined") return;
  try {
    const list = getRecentlyViewed().filter((x) => x.id !== p.id);
    list.unshift(p);
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* ignore storage errors */
  }
}

/** Read the recently-viewed products (most recent first). */
export function getRecentlyViewed(): RecentProduct[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RecentProduct[]) : [];
  } catch {
    return [];
  }
}
