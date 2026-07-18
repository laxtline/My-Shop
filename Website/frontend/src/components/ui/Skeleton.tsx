import { cn } from "@/lib/cn";

/** Shimmering placeholder block used by loading states. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-lg bg-slate-200/70", className)}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </div>
  );
}

/** A product-card-shaped skeleton, reused across grids and rails. */
export function ProductCardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-card">
      <Skeleton className="aspect-square w-full rounded-xl" />
      <Skeleton className="mt-3 h-3 w-1/3" />
      <Skeleton className="mt-2 h-4 w-full" />
      <Skeleton className="mt-2 h-4 w-2/3" />
      <Skeleton className="mt-3 h-6 w-1/2" />
    </div>
  );
}
