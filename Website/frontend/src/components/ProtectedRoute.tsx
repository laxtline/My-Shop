"use client";

import { type ReactNode } from "react";
import { useAppSelector } from "@/store/hooks";

/**
 * Reusable gate for content that requires authentication (and optionally ADMIN).
 * In Phase 0 the whole app sits behind <AuthGate>, but later phases use this
 * wrapper for account/admin routes.
 */
export function ProtectedRoute({
  children,
  adminOnly = false,
  fallback = null,
}: {
  children: ReactNode;
  adminOnly?: boolean;
  fallback?: ReactNode;
}) {
  const user = useAppSelector((s) => s.auth.user);

  if (!user) return <>{fallback}</>;
  if (adminOnly && user.role !== "ADMIN") {
    return (
      <>
        {fallback ?? (
          <div className="p-8 text-center text-slate-500">
            You don’t have permission to view this page.
          </div>
        )}
      </>
    );
  }
  return <>{children}</>;
}
