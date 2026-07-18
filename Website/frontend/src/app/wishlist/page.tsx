import type { Metadata } from "next";
import { WishlistView } from "@/components/storefront/WishlistView";

export const metadata: Metadata = {
  title: "Your Wishlist",
  robots: { index: false, follow: false },
};

export default function WishlistPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Your wishlist</h1>
      <WishlistView />
    </div>
  );
}
