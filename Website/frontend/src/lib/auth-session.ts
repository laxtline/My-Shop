import type { Role } from "@shared/types";

const GUEST_SESSION_KEY = "rt_guest_session";

/** Guest browsing is an explicit choice for this tab, never the default. */
export function hasGuestSession(): boolean {
  try {
    return sessionStorage.getItem(GUEST_SESSION_KEY) === "true";
  } catch {
    return false;
  }
}

export function saveGuestSession(guest: boolean): void {
  try {
    if (guest) sessionStorage.setItem(GUEST_SESSION_KEY, "true");
    else sessionStorage.removeItem(GUEST_SESSION_KEY);
  } catch {
    // Browsing still works in memory if browser storage is unavailable.
  }
}

/** Only allow local destinations after sign-in. */
export function loginDestination(path: string | null): string {
  if (!path?.startsWith("/") || path.startsWith("//") || /[\\\s]/.test(path)) {
    return "/products";
  }
  const url = new URL(path, "https://shop.local");
  return url.origin === "https://shop.local" && url.pathname !== "/login"
    ? `${url.pathname}${url.search}${url.hash}`
    : "/products";
}

export function signedInDestination(role: Role, path: string | null): string {
  if (role === "ADMIN") return "/admin";
  const destination = loginDestination(path);
  const pathname = new URL(destination, "https://shop.local").pathname;
  return pathname === "/admin" || pathname.startsWith("/admin/") ? "/products" : destination;
}
