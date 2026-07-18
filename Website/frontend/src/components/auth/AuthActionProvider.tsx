"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchCart, clearCart } from "@/store/cartSlice";
import { fetchWishlist, clearWishlist } from "@/store/wishlistSlice";
import { clearOrders } from "@/store/ordersSlice";
import { LoginDialog } from "./LoginDialog";

type Action = () => void;

interface AuthActionContext {
  /** Run `action` if signed in; otherwise open the login dialog and run it after login. */
  requireAuth: (action: Action, reason?: string) => void;
  /** Open the login dialog with no follow-up action. */
  promptLogin: (reason?: string) => void;
}

const Ctx = createContext<AuthActionContext | null>(null);

export function useAuthAction(): AuthActionContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuthAction must be used within <AuthActionProvider>");
  return ctx;
}

export function AuthActionProvider({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | undefined>();
  const pending = useRef<Action | null>(null);
  const prevUser = useRef(user);

  const requireAuth = useCallback(
    (action: Action, reasonText?: string) => {
      if (user) {
        action();
        return;
      }
      pending.current = action;
      setReason(reasonText);
      setOpen(true);
    },
    [user]
  );

  const promptLogin = useCallback((reasonText?: string) => {
    pending.current = null;
    setReason(reasonText);
    setOpen(true);
  }, []);

  // React to auth transitions: hydrate cart/wishlist on login, clear on logout.
  useEffect(() => {
    const was = prevUser.current;
    prevUser.current = user;

    if (!was && user) {
      // Just logged in.
      dispatch(fetchCart());
      dispatch(fetchWishlist());
      setOpen(false);
      if (pending.current) {
        const action = pending.current;
        pending.current = null;
        action();
      }
    } else if (was && !user) {
      // Just logged out.
      dispatch(clearCart());
      dispatch(clearWishlist());
      dispatch(clearOrders());
    } else if (user) {
      // Already authenticated on first mount (returning session).
      dispatch(fetchCart());
      dispatch(fetchWishlist());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <Ctx.Provider value={{ requireAuth, promptLogin }}>
      {children}
      <LoginDialog open={open} onClose={() => setOpen(false)} reason={reason} />
    </Ctx.Provider>
  );
}
