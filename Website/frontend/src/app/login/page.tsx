"use client";

import { Suspense, useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GoogleLogin } from "@react-oauth/google";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { clearAuthError, continueAsGuest, loginWithGoogle, logout, setAuthError } from "@/store/authSlice";
import { saveGuestSession, signedInDestination } from "@/lib/auth-session";
import { Button } from "@/components/ui/Button";
import styles from "./login.module.css";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

export default function LoginPage() {
  return <Suspense fallback={<Loading />}><LoginOptions /></Suspense>;
}

function Loading() {
  return <div className="grid min-h-screen place-items-center text-slate-500" role="status">Loading sign-in options...</div>;
}

function LoginOptions() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const { user, status, error } = useAppSelector((s) => s.auth);
  const brand = useAppSelector((s) => s.brand.brand);
  const googleContainer = useRef<HTMLDivElement>(null);
  const [googleWidth, setGoogleWidth] = useState(320);
  const [hydrated, setHydrated] = useState(false);
  const redirectTo = searchParams.get("redirect");
  const busy = status === "authenticating" || status === "signing-out";

  useEffect(() => {
    setHydrated(true);
    dispatch(clearAuthError());
  }, [dispatch]);

  useEffect(() => {
    const container = googleContainer.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      setGoogleWidth(Math.min(400, Math.floor(entry.contentRect.width)));
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [status, user, hydrated]);

  const handleGoogleSuccess = async (credential: string) => {
    const result = await dispatch(loginWithGoogle(credential));
    if (loginWithGoogle.fulfilled.match(result)) {
      router.replace(signedInDestination(result.payload.role, redirectTo));
    }
  };

  const handleGuestContinue = () => {
    saveGuestSession(true);
    dispatch(continueAsGuest());
    router.replace("/products");
  };

  if (!hydrated || status === "bootstrapping") return <Loading />;

  return (
    <div
      className={styles.page}
      style={{ "--login-accent": /^#[\da-f]{6}$/i.test(brand.themeColor) ? brand.themeColor : "#2563eb" } as CSSProperties}
    >
      <header className={styles.topbar}>
        <span className={styles.headerBrand}>{brand.appName}</span>
        <span className={styles.headerTitle}>Login</span>
      </header>

      <main className={styles.main}>
        <div className={styles.content}>
          <div className={styles.logoScene}>
            <span className={styles.logoHalo} aria-hidden="true" />
            <span className={styles.sparkOne} aria-hidden="true" />
            <span className={styles.sparkTwo} aria-hidden="true" />
            <span className={styles.sparkThree} aria-hidden="true" />
            <img src={brand.logoUrl} alt={`${brand.appName} logo`} className={styles.logo} />
          </div>
          <p className={styles.brandName}>{brand.appName}</p>
          <h1 className={styles.heading}>Access your account</h1>
          <p className={styles.subtitle}>Login to continue to our store</p>

          {user ? (
            <div className={styles.actions}>
              <p className={styles.signedIn}>Signed in as <strong>{user.name}</strong><br />{user.email}</p>
              <Button className={styles.continueButton} disabled={busy} onClick={() => router.replace(signedInDestination(user.role, redirectTo))}>
                Continue to {user.role === "ADMIN" ? "admin dashboard" : "shop"}
              </Button>
              <button className={styles.guestButton} disabled={busy} onClick={() => dispatch(logout())}>
                {busy ? "Signing out..." : "Sign out / Switch account"}
              </button>
            </div>
          ) : (
            <div className={styles.actions}>
              <div ref={googleContainer} className={styles.googleContainer}>
                {!GOOGLE_CLIENT_ID ? (
                  <p className={styles.notice}>Google sign-in is currently unavailable. Please try again later or continue as a guest.</p>
                ) : (
                  <div className={busy ? styles.busy : undefined} inert={busy}>
                    <GoogleLogin
                      onSuccess={(response) => {
                        if (response.credential) void handleGoogleSuccess(response.credential);
                        else dispatch(setAuthError("Google did not return a sign-in credential. Please try again."));
                      }}
                      onError={() => dispatch(setAuthError("Google sign-in could not start. Allow pop-ups for this site and try again."))}
                      auto_select={false}
                      useOneTap={false}
                      theme="outline"
                      size="large"
                      shape="pill"
                      text="signin_with"
                      width={googleWidth}
                      containerProps={{ style: { display: "flex", justifyContent: "center" } }}
                    />
                  </div>
                )}
              </div>
              <div className={styles.divider}><span>OR</span></div>
              <button onClick={handleGuestContinue} disabled={busy} className={styles.guestButton}>
                <svg width="24" height="26" viewBox="0 0 24 26" fill="currentColor" aria-hidden="true">
                  <circle cx="12" cy="6" r="5" />
                  <path d="M2 24v-3a10 10 0 0 1 20 0v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1Z" />
                </svg>
                Continue as Guest
              </button>
            </div>
          )}

          {status === "authenticating" && <p className={styles.feedback} role="status">Signing you in...</p>}
          {error && <div className={styles.error} role="alert">{error}</div>}
          <p className={styles.support}>Need a hand? <a href={`tel:${brand.supportPhone}`}>We&apos;re here to help</a></p>
        </div>
      </main>

      <svg className={styles.waves} viewBox="0 0 1440 150" fill="none" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 45C210-16 370 60 620 85C950 119 1130 1 1440 8V150H0Z" fill="currentColor" fillOpacity=".12" />
        <path d="M0 93C250 17 490 133 790 126C1090 119 1220 63 1440 60V150H0Z" fill="currentColor" fillOpacity=".18" />
      </svg>
    </div>
  );
}
