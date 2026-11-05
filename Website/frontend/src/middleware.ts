import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Paths that require authentication
const PROTECTED_PATHS = [
  "/",           // Home page - redirect to login if not authenticated
  "/cart",
  "/checkout",
  "/account",
  "/orders",
  "/wishlist",
  "/track",
  "/admin",
  "/products",   // Product listing
  "/categories", // Categories
  "/search",     // Search
];

// Paths that should redirect to home if already authenticated
const AUTH_PATHS = ["/login"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("rt_token")?.value;
  const isAuthenticated = !!token;

  // Check if path is protected
  const isProtected = PROTECTED_PATHS.some((path) => pathname.startsWith(path));
  const isAuthPage = AUTH_PATHS.some((path) => pathname === path);

  // If accessing protected path without auth, redirect to login
  if (isProtected && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If accessing login page while authenticated, redirect to home
  if (isAuthPage && isAuthenticated) {
    const redirectTo = request.nextUrl.searchParams.get("redirect") || "/products";
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!api|_next/static|_next/image|favicon.ico|public).*)",
  ],
};