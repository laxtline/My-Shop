"use client";

import Link from "next/link";
import { useAppSelector } from "@/store/hooks";
import { SocialLinks } from './SocialLinks';

/** Site footer with brand blurb, category links and support contact. */
export function SiteFooter() {
  const brand = useAppSelector((s) => s.brand.brand);
  const categories = useAppSelector((s) => s.categories.items);
  const year = new Date().getFullYear();
  const waLink = `https://wa.me/91${brand.supportPhone}`;

  return (
    <footer className="mt-10 border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={brand.logoUrl} alt="" className="h-9 w-9 rounded-lg" />
            <span className="text-lg font-bold text-slate-900">{brand.appName}</span>
          </div>
          <p className="mt-3 text-sm text-slate-500">{brand.tagline}</p>
          <SocialLinks />
        </div>

        <div>
          <h4 className="text-sm font-semibold text-slate-800">Shop</h4>
          <ul className="mt-3 space-y-2 text-sm text-slate-500">
            <li>
              <Link href="/products" className="hover:text-brand">
                All products
              </Link>
            </li>
            <li><Link href="/categories" className="hover:text-brand">All categories</Link></li>
            {categories.slice(0, 8).map((c) => (
              <li key={c.id}>
                <Link href={`/products?category=${c.slug}`} className="hover:text-brand">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-slate-800">Account</h4>
          <ul className="mt-3 space-y-2 text-sm text-slate-500">
            <li>
              <Link href="/cart" className="hover:text-brand">
                My cart
              </Link>
            </li>
            <li>
              <Link href="/wishlist" className="hover:text-brand">
                My wishlist
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-slate-800">Need help?</h4>
          <ul className="mt-3 space-y-2 text-sm text-slate-500">
            <li>
              <a href="tel:6370419708" className="hover:text-brand">
                📞 6370419708
              </a>
            </li>
            <li>
              <a href="https://api.whatsapp.com/send/?phone=916370419708&text&type=phone_number&app_absent=0" target="_blank" rel="noopener noreferrer" className="hover:text-brand">
                💬 WhatsApp
              </a>
            </li>
            <li>
              <a href={`mailto:${brand.supportEmail}`} className="break-all hover:text-brand">
                ✉️ {brand.supportEmail}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-slate-100 py-4 text-center text-xs text-slate-400">
        © {year} {brand.appName}. All rights reserved.
      </div>
    </footer>
  );
}
