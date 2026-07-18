import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Product } from "@shared/types";

export interface CartLine {
  product: Product;
  quantity: number;
}

interface CartContext {
  lines: CartLine[];
  count: number;
  total: number;
  add: (product: Product, quantity?: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
}

const Ctx = createContext<CartContext | null>(null);

export function useCart(): CartContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart must be used within <CartProvider>");
  return ctx;
}

/**
 * Simple in-memory cart for the mobile starter. (The website persists the cart
 * server-side after login; wiring Google Sign-In + the /api/cart endpoints here
 * is the next step — see README.)
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);

  const value = useMemo<CartContext>(() => {
    const add = (product: Product, quantity = 1) =>
      setLines((prev) => {
        const existing = prev.find((l) => l.product.id === product.id);
        if (existing) {
          return prev.map((l) =>
            l.product.id === product.id ? { ...l, quantity: l.quantity + quantity } : l
          );
        }
        return [...prev, { product, quantity }];
      });

    const remove = (productId: string) =>
      setLines((prev) => prev.filter((l) => l.product.id !== productId));

    const clear = () => setLines([]);

    const count = lines.reduce((n, l) => n + l.quantity, 0);
    const total = lines.reduce((sum, l) => sum + l.product.price * l.quantity, 0);

    return { lines, count, total, add, remove, clear };
  }, [lines]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
