"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAppSelector } from "@/store/hooks";
import { AppHeader } from "./AppHeader";
import { SiteFooter } from "./SiteFooter";
import { BottomNav } from "./BottomNav";

/**
 * Require a checked Google session or an explicit guest choice before browsing.
 * The login page has its own layout; the storefront gets the navigation chrome.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, status, isGuest } = useAppSelector((s) => s.auth);
  const isLoginPage = pathname === "/login";
  const needsLogin = !user && !isGuest;
  const busy = status === "bootstrapping" || status === "signing-out";

  useEffect(() => {
    if (!isLoginPage && !busy && needsLogin) {
      const destination = window.location.pathname + window.location.search;
      router.replace(`/login?redirect=${encodeURIComponent(destination)}`);
    }
  }, [isLoginPage, busy, needsLogin, router, pathname]);

  if (isLoginPage) return <>{children}</>;
  if (busy || needsLogin) {
    return <div className="grid min-h-screen place-items-center text-slate-500" role="status">{status === "signing-out" ? "Signing out..." : "Loading..."}</div>;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
      <SiteFooter />
      <BottomNav />
    </div>
  );
}
