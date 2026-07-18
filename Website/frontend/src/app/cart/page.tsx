import type { Metadata } from "next";
import { CartView } from "@/components/storefront/CartView";

export const metadata: Metadata = {
  title: "Your Cart",
  robots: { index: false, follow: false },
};

export default function CartPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Your cart</h1>
      <CartView />
    </div>
  );
}
