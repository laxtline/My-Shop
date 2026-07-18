import { cn } from "@/lib/cn";
import { formatINR, discountPercent } from "@/lib/format";

/**
 * Displays selling price with optional struck-through MRP and a discount badge.
 * Sizes scale the primary price; MRP and badge follow proportionally.
 */
export function Price({
  price,
  mrp,
  size = "md",
  className,
}: {
  price: number;
  mrp?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const pct = mrp ? discountPercent(price, mrp) : 0;
  const showMrp = mrp != null && mrp > price;

  const priceSize = size === "lg" ? "text-3xl" : size === "sm" ? "text-base" : "text-xl";
  const mrpSize = size === "lg" ? "text-base" : "text-sm";

  return (
    <div className={cn("flex flex-wrap items-baseline gap-2", className)}>
      <span className={cn("font-bold text-slate-900", priceSize)}>{formatINR(price)}</span>
      {showMrp && (
        <>
          <span className={cn("text-slate-400 line-through", mrpSize)}>{formatINR(mrp!)}</span>
          {pct > 0 && (
            <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-700">
              {pct}% off
            </span>
          )}
        </>
      )}
    </div>
  );
}
