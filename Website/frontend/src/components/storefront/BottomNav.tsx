"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppSelector } from "@/store/hooks";
import { selectCartCount } from "@/store/cartSlice";
import { selectWishlistCount } from "@/store/wishlistSlice";
import { cn } from "@/lib/cn";

const ITEMS = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/products", label: "Shop", icon: "🛍️" },
  { href: "/wishlist", label: "Wishlist", icon: "♡" },
  { href: "/cart", label: "Cart", icon: "🛒" },
];

/** Mobile-only sticky bottom navigation. */
export function BottomNav() {
  const pathname = usePathname();
  const cartCount = useAppSelector(selectCartCount);
  const wishCount = useAppSelector(selectWishlistCount);

  const badgeFor = (href: string) =>
    href === "/cart" ? cartCount : href === "/wishlist" ? wishCount : 0;

  return (
    <nav className="sticky bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-md">
        {ITEMS.map((it) => {
          const active = it.href === "/" ? pathname === "/" : pathname.startsWith(it.href);
          const count = badgeFor(it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium",
                active ? "text-brand" : "text-slate-500"
              )}
            >
              <span className="text-lg" aria-hidden>
                {it.icon}
              </span>
              {it.label}
              {count > 0 && (
                <span className="absolute right-[22%] top-1 grid h-4 min-w-[1rem] place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
