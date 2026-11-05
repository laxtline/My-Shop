"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/admin", label: "Orders" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/coupons", label: "Coupons" },
  { href: "/admin/brand", label: "Brand" },
];

/** Segmented navigation shared across the admin pages. */
export function AdminTabs() {
  const pathname = usePathname();
  return (
    <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
              active ? "bg-white text-brand shadow-sm" : "text-slate-600 hover:text-slate-900"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
