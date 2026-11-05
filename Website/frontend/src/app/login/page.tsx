"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { GoogleLogin } from "@react-oauth/google";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { loginWithGoogle, fetchMe, setAuthError } from "@/store/authSlice";
import { Button } from "@/components/ui/Button";
import { fetchBrand } from "@/store/brandSlice";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const ADMIN_EMAIL = "suryakant321pradhan@gmail.com";

/**
 * Login page with three options:
 * - Admin: Google OAuth with admin email
 * - Customer: Google OAuth with any Gmail
 * - Guest: Continue without login (browse only)
 */
export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const { status, error } = useAppSelector((s) => s.auth);
  const brand = useAppSelector((s) => s.brand.brand);
  const redirectTo = searchParams.get("redirect") || "/products";

  const [showGuestNotice, setShowGuestNotice] = useState(false);

  // Fetch brand config on mount
  useEffect(() => {
    dispatch(fetchBrand());
    // Also try to restore session
    dispatch(fetchMe());
  }, [dispatch]);

  const handleGoogleSuccess = (credential: string) => {
    if (credential) dispatch(loginWithGoogle(credential));
  };

  const handleGoogleError = () => {
    dispatch(
      setAuthError(
        "Google sign-in could not start. Allow pop-ups for this site and try again."
      )
    );
  };

  const handleGuestContinue = () => {
    // Guest can browse products but will need to login at checkout
    setShowGuestNotice(true);
    setTimeout(() => router.push("/products"), 1500);
  };

  const isConfigMissing = !GOOGLE_CLIENT_ID;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <img
              src={brand.logoUrl}
              alt={`${brand.appName} logo`}
              className="h-16 w-16 rounded-xl object-contain mx-auto"
            />
          </Link>
          <h1 className="text-3xl font-bold text-slate-900">{brand.appName}</h1>
          <p className="mt-2 text-slate-500">{brand.tagline}</p>
        </div>

        {/* Login Options */}
        <div className="space-y-4">
          {/* Admin Login */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
            <div className="flex items-center gap-3 mb-4">
              <span className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center text-red-600 text-xl">
                🛡️
              </span>
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Admin Login</h3>
                <p className="text-xs text-slate-500">Access admin dashboard & analytics</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Sign in with <strong>{ADMIN_EMAIL}</strong> to access admin features.
            </p>
            {isConfigMissing ? (
              <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
                Google Sign-In not configured. Set <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> in
                <code>.env.local</code>.
              </div>
            ) : (
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                disabled={status === "authenticating"}
                theme="filled_blue"
                size="large"
                shape="pill"
                text="continue_with"
                logo_alignment="left"
                className="w-full"
              />
            )}
            {status === "authenticating" && (
              <p className="mt-3 text-center text-xs text-slate-400">Signing you in…</p>
            )}
          </div>

          {/* Customer Login */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
            <div className="flex items-center gap-3 mb-4">
              <span className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 text-xl">
                👤
              </span>
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Customer Login</h3>
                <p className="text-xs text-slate-500">Sign in with your Google account</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Use any Gmail/Google account to access your cart, orders, wishlist, and checkout.
            </p>
            {isConfigMissing ? (
              <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
                Google Sign-In not configured. Set <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> in
                <code>.env.local</code>.
              </div>
            ) : (
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                disabled={status === "authenticating"}
                theme="filled_blue"
                size="large"
                shape="pill"
                text="continue_with"
                logo_alignment="left"
                className="w-full"
              />
            )}
            {status === "authenticating" && (
              <p className="mt-3 text-center text-xs text-slate-400">Signing you in…</p>
            )}
          </div>

          {/* Guest Continue */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
            <div className="flex items-center gap-3 mb-4">
              <span className="h-10 w-10 rounded-xl bg-green-100 flex items-center justify-center text-green-600 text-xl">
                🛍️
              </span>
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Continue as Guest</h3>
                <p className="text-xs text-slate-500">Browse products without signing in</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Browse products and add to cart. You&apos;ll be prompted to sign in only at checkout.
            </p>
            <Button
              onClick={handleGuestContinue}
              variant="outline"
              className="w-full"
              size="lg"
            >
              Continue as Guest
            </Button>
            {showGuestNotice && (
              <p className="mt-3 text-center text-xs text-green-600">Redirecting to products…</p>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 text-center" role="alert">
            {error}
          </div>
        )}

        {/* Footer Info */}
        <div className="mt-8 text-center text-xs text-slate-400">
          <p>By continuing, you agree to our Terms of Service and Privacy Policy.</p>
          <p className="mt-1">Need help? <a href="tel:6370419708" className="text-brand hover:underline">Call us</a> or
            <a href="https://api.whatsapp.com/send/?phone=916370419708" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline ml-1">
              WhatsApp
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}