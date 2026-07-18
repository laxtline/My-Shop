"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { logout } from "@/store/authSlice";
import { selectCartCount } from "@/store/cartSlice";
import { selectWishlistCount } from "@/store/wishlistSlice";
import { SearchBar } from "./SearchBar";
import { ThemeToggle } from "./ThemeToggle";

/** Sticky top navigation: brand, search, wishlist/cart badges, account menu, category strip. */
export function AppHeader() {
  const dispatch = useAppDispatch();
  const brand = useAppSelector((s) => s.brand.brand);
  const user = useAppSelector((s) => s.auth.user);
  const categories = useAppSelector((s) => s.categories.items);
  const cartCount = useAppSelector(selectCartCount);
  const wishCount = useAppSelector(selectWishlistCount);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={brand.logoUrl} alt="" className="h-9 w-9 rounded-lg" />
          <span className="hidden text-lg font-bold text-slate-900 sm:block">{brand.appName}</span>
        </Link>

        <SearchBar className="hidden flex-1 md:block" />

        <nav className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <IconLink href="/wishlist" label="Wishlist" icon="♡" count={wishCount} />
          <IconLink href="/cart" label="Cart" icon="🛒" count={cartCount} />

          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-10 items-center rounded-full px-1 hover:bg-slate-100 focus-ring"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Account menu"
            >
              {user?.picture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.picture} alt="" className="h-8 w-8 rounded-full" />
              ) : (
                <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                  {user?.name?.[0]?.toUpperCase() ?? "U"}
                </span>
              )}
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden />
                <div
                  className="absolute right-0 z-20 mt-2 w-56 animate-fade-in rounded-xl border border-slate-200 bg-white p-2 shadow-card-hover"
                  role="menu"
                >
                  <div className="px-3 py-2">
                    <span className="block font-semibold text-slate-800">{user?.name ?? "Guest"}</span>
                    <span className="block truncate text-xs text-slate-400">{user?.email}</span>
                  </div>
                  <hr className="my-1 border-slate-100" />
                  <MenuLink href="/account" onClick={() => setMenuOpen(false)}>
                    My account
                  </MenuLink>
                  <MenuLink href="/products" onClick={() => setMenuOpen(false)}>
                    All products
                  </MenuLink>
                  <MenuLink href="/orders" onClick={() => setMenuOpen(false)}>
                    My orders
                  </MenuLink>
                  <MenuLink href="/wishlist" onClick={() => setMenuOpen(false)}>
                    My wishlist
                  </MenuLink>
                  <MenuLink href="/cart" onClick={() => setMenuOpen(false)}>
                    My cart
                  </MenuLink>
                  {user?.role === "ADMIN" && (
                    <>
                      <hr className="my-1 border-slate-100" />
                      <MenuLink href="/admin" onClick={() => setMenuOpen(false)}>
                        🛠️ Admin dashboard
                      </MenuLink>
                    </>
                  )}
                  <hr className="my-1 border-slate-100" />
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      dispatch(logout());
                    }}
                    className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                    role="menuitem"
                  >
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </nav>
      </div>

      {/* Category quick-nav */}
      <div className="border-t border-slate-100">
        <div className="no-scrollbar mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 py-2">
          <CatLink href="/products">All</CatLink>
          {categories.map((c) => (
            <CatLink key={c.id} href={`/products?category=${c.slug}`}>
              {c.name}
            </CatLink>
          ))}
        </div>
      </div>

      {/* Mobile search */}
      <div className="border-t border-slate-100 px-4 py-2 md:hidden">
        <SearchBar />
      </div>
    </header>
  );
}

function IconLink({
  href,
  label,
  icon,
  count,
}: {
  href: string;
  label: string;
  icon: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      aria-label={`${label}${count > 0 ? ` (${count})` : ""}`}
      className="relative grid h-10 w-10 place-items-center rounded-full text-lg hover:bg-slate-100 focus-ring"
    >
      <span aria-hidden>{icon}</span>
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-brand px-1 text-[11px] font-bold text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

function MenuLink({ href, onClick, children }: { href: string; onClick: () => void; children: ReactNode }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
      role="menuitem"
    >
      {children}
    </Link>
  );
}

function CatLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-brand"
    >
      {children}
    </Link>
  );
}
