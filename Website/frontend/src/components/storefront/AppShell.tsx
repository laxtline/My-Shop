import type { ReactNode } from "react";
import { AppHeader } from "./AppHeader";
import { SiteFooter } from "./SiteFooter";
import { BottomNav } from "./BottomNav";

/**
 * App chrome shown to authenticated users: header + page content + footer,
 * with a mobile bottom nav. Server-component children (catalog pages) render
 * through the `children` slot untouched.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
      <SiteFooter />
      <BottomNav />
    </div>
  );
}
