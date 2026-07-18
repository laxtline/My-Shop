import type { Metadata } from "next";
import { AdminDashboard } from "@/components/storefront/AdminDashboard";

export const metadata: Metadata = {
  title: "Admin · Ramachandra Traders",
};

export default function AdminPage() {
  return <AdminDashboard />;
}
