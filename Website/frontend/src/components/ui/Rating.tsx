import { cn } from "@/lib/cn";

/** Compact star rating with optional review count. Read-only display. */
export function Rating({
  value,
  count,
  size = "sm",
  className,
}: {
  value: number;
  count?: number;
  size?: "sm" | "md";
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  const star = size === "md" ? "text-lg" : "text-sm";

  return (
    <div className={cn("inline-flex items-center gap-1.5", className)} aria-label={`Rated ${value} out of 5`}>
      <span className={cn("relative inline-block leading-none", star)}>
        <span className="text-slate-300">★★★★★</span>
        <span
          className="absolute inset-0 overflow-hidden text-amber-400"
          style={{ width: `${pct}%` }}
          aria-hidden
        >
          ★★★★★
        </span>
      </span>
      {count != null && <span className="text-xs text-slate-500">({count})</span>}
    </div>
  );
}
