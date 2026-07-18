import type { Metadata } from "next";
import { CheckoutView } from "@/components/storefront/CheckoutView";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Checkout</h1>
      <CheckoutView />
    </div>
  );
}
