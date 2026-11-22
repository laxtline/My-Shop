import type { Metadata } from "next";
import { AdminShipmentsView } from "@/components/storefront/AdminShipmentsView";

export const metadata: Metadata = {
  title: "Shipping · Ramachandra Traders Admin",
};

export default function AdminShipmentsPage() {
  return <AdminShipmentsView />;
}
