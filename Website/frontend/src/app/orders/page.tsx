import type { Metadata } from "next";
import { OrdersListView } from "@/components/storefront/OrdersListView";

export const metadata: Metadata = {
  title: "My Orders",
  robots: { index: false, follow: false },
};

export default function OrdersPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">My orders</h1>
      <OrdersListView />
    </div>
  );
}
