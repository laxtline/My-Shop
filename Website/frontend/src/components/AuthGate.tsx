"use client";

import { type ReactNode } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { loginWithGoogle, setAuthError } from "@/store/authSlice";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

/**
 * Full-screen login gate. No app content is interactive until the user signs in.
 * While a session is being checked, a splash is shown (no flash of the login form).
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const { status, error } = useAppSelector((s) => s.auth);
  const brand = useAppSelector((s) => s.brand.brand);

  // 1) Checking existing session — splash.
  if (status === "bootstrapping") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 gap-4">
        <Logo brand={brand} size={64} />
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-brand" />
        <p className="text-sm text-slate-400">Loading {brand.appName}…</p>
      </div>
    );
  }

  // 2) Authenticated — render the real app.
  if (status === "authenticated") {
    return <>{children}</>;
  }

  // 3) Anonymous / authenticating — gate over a blurred, inert app.
  const configMissing = !GOOGLE_CLIENT_ID;

  return (
    <div className="relative min-h-screen">
      {/* Hidden/blurred app behind the gate */}
      <div aria-hidden className="pointer-events-none select-none blur-sm">
        {children}
      </div>

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-100 via-white to-blue-50 px-4">
        <div className="animate-fade-in w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl text-center">
          <div className="mb-5 flex justify-center">
            <Logo brand={brand} size={72} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">{brand.appName}</h1>
          <p className="mt-1 text-sm text-slate-500">{brand.tagline}</p>

          <div className="my-7 h-px bg-slate-100" />

          <p className="mb-4 text-sm font-medium text-slate-600">
            Sign in to continue
          </p>

          {configMissing ? (
            <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
              Google Sign-In is not configured. Set{" "}
              <code className="font-mono">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> in
              <code className="font-mono"> .env.local</code>.
            </p>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className={status === "authenticating" ? "pointer-events-none opacity-60" : ""}>
                <GoogleLogin
                  onSuccess={(cred) => {
                    if (cred.credential) dispatch(loginWithGoogle(cred.credential));
                  }}
                  onError={() => {
                    // Google's widget failed before our thunk could run (popup
                    // blocked, origin not authorised, bad client ID). Nothing
                    // dispatches on this path, so set the error ourselves —
                    // otherwise the button appears to do nothing at all.
                    dispatch(
                      setAuthError(
                        "Google sign-in could not start. Allow pop-ups for this site and try again."
                      )
                    );
                  }}
                  theme="filled_blue"
                  size="large"
                  shape="pill"
                  text="continue_with"
                />
              </div>
              {status === "authenticating" && (
                <p className="text-xs text-slate-400">Signing you in…</p>
              )}
              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
          )}

          <p className="mt-7 text-xs text-slate-400">
            Need help? Call{" "}
            <a className="text-brand hover:underline" href={`tel:${brand.supportPhone}`}>
              {brand.supportPhone}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

function Logo({ brand, size }: { brand: { logoUrl: string; appName: string }; size: number }) {
  // Use a plain <img> so any logoUrl (including same-origin SVG) just works.
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={brand.logoUrl}
      alt={`${brand.appName} logo`}
      width={size}
      height={size}
      className="rounded-xl object-contain"
      style={{ width: size, height: size }}
    />
  );
}
