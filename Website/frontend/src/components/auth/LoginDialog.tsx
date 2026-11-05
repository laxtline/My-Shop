"use client";

import { useEffect } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { loginWithGoogle, setAuthError } from "@/store/authSlice";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

/**
 * Modal sign-in prompt shown when an anonymous user attempts a protected action
 * (add to cart, wishlist, checkout). Reuses the Google credential flow.
 */
export function LoginDialog({
  open,
  onClose,
  reason,
}: {
  open: boolean;
  onClose: () => void;
  reason?: string;
}) {
  const dispatch = useAppDispatch();
  const { status, error } = useAppSelector((s) => s.auth);
  const brand = useAppSelector((s) => s.brand.brand);
  const configMissing = !GOOGLE_CLIENT_ID;

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Sign in"
      onClick={onClose}
    >
      <div
        className="animate-fade-in w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={brand.logoUrl} alt={`${brand.appName} logo`} className="h-16 w-16 rounded-xl object-contain" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Sign in to continue</h2>
        <p className="mt-1 text-sm text-slate-500">{reason ?? `Sign in to ${brand.appName} to continue.`}</p>

        <div className="my-6 h-px bg-slate-100" />

        {configMissing ? (
          <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
            Google Sign-In is not configured. Set{" "}
            <code className="font-mono">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> in <code>.env.local</code>.
          </p>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className={status === "authenticating" ? "pointer-events-none opacity-60" : ""}>
              <GoogleLogin
                auto_select={false}
                useOneTap={false}
                onSuccess={(cred) => {
                  if (cred.credential) dispatch(loginWithGoogle(cred.credential));
                }}
                onError={() => {
                  // See AuthGate: Google's own widget can fail before
                  // `loginWithGoogle` is ever dispatched, leaving the user with
                  // a dead button and no message unless we set the error here.
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
            {status === "authenticating" && <p className="text-xs text-slate-400">Signing you in…</p>}
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-6 text-xs font-medium text-slate-400 hover:text-slate-600 focus-ring"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
