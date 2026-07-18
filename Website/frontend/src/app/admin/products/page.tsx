import type { Metadata } from "next";
import { AdminProductsView } from "@/components/storefront/AdminProductsView";

export const metadata: Metadata = {
  title: "Admin · Products · Ramachandra Traders",
};

export default function AdminProductsPage() {
  return <AdminProductsView />;
}
