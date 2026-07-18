import Link from "next/link";
import { cn } from "@/lib/cn";

/** Query-string preserving pager for catalog listings. */
export function Pagination({
  page,
  totalPages,
  params,
  basePath = "/products",
}: {
  page: number;
  totalPages: number;
  params: Record<string, string>;
  basePath?: string;
}) {
  if (totalPages <= 1) return null;

  const hrefFor = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (k !== "page" && v != null && String(v).trim() !== "") sp.set(k, String(v));
    }
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  // Compact window of pages around the current one.
  const pages: number[] = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, start + 4);
  for (let p = start; p <= end; p++) pages.push(p);

  return (
    <nav className="mt-8 flex items-center justify-center gap-1" aria-label="Pagination">
      {page > 1 && (
        <Link href={hrefFor(page - 1)} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
          ← Prev
        </Link>
      )}
      {pages.map((p) => (
        <Link
          key={p}
          href={hrefFor(p)}
          aria-current={p === page ? "page" : undefined}
          className={cn(
            "grid h-10 min-w-[2.5rem] place-items-center rounded-lg px-2 text-sm font-medium",
            p === page ? "bg-brand text-white" : "text-slate-600 hover:bg-slate-100"
          )}
        >
          {p}
        </Link>
      ))}
      {page < totalPages && (
        <Link href={hrefFor(page + 1)} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
          Next →
        </Link>
      )}
    </nav>
  );
}
