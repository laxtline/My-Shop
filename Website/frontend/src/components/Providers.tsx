"use client";

import { useRef, useEffect, type ReactNode } from "react";
import { Provider } from "react-redux";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { makeStore, type AppStore } from "@/store";
import { fetchMe } from "@/store/authSlice";
import { fetchBrand } from "@/store/brandSlice";
import { fetchCategories } from "@/store/categoriesSlice";
import { AuthActionProvider } from "@/components/auth/AuthActionProvider";
import { ToastProvider } from "@/components/ui/Toast";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

/** Bootstraps brand + session as soon as the store exists. */
function Bootstrap({ store }: { store: AppStore }) {
  useEffect(() => {
    store.dispatch(fetchBrand());
    store.dispatch(fetchMe());
    store.dispatch(fetchCategories());
  }, [store]);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const storeRef = useRef<AppStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = makeStore();
  }

  return (
    <Provider store={storeRef.current}>
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <Bootstrap store={storeRef.current} />
        <ToastProvider>
          <AuthActionProvider>{children}</AuthActionProvider>
        </ToastProvider>
      </GoogleOAuthProvider>
    </Provider>
  );
}
