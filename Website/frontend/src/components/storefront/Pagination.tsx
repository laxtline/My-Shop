"use client";
import Link from 'next/link';
import { useRouter } from 'next/navigation';

/** Cursor links avoid database offsets as the catalogue grows. */
export function Pagination({ page, totalPages, params, basePath = '/products', nextCursor }: {
  page: number; totalPages: number; params: Record<string, string>; basePath?: string; nextCursor?: string | null;
}) {
  const router = useRouter();
  const href = (cursor: string | null, nextPage: number) => {
    const query = new URLSearchParams(params);
    query.delete('cursor'); query.delete('page');
    if (cursor) { query.set('cursor', cursor); query.set('page', String(nextPage)); }
    return `${basePath}${query.size ? `?${query}` : ''}`;
  };
  if (!params.cursor && !nextCursor && totalPages <= 1) return null;
  return <nav aria-label="Pagination" className="mt-6 flex justify-center gap-4 text-sm font-semibold text-brand">
    {params.cursor && <><button type="button" onClick={() => router.back()} className="rounded-lg border border-slate-200 px-3 py-2">Previous</button>
      <Link href={href(null, 1)} className="px-3 py-2">First page</Link></>}
    {nextCursor && <Link prefetch={false} href={href(nextCursor, page + 1)} className="rounded-lg border border-slate-200 px-3 py-2">Next →</Link>}
  </nav>;
}
