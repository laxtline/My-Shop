import type { Metadata } from "next";
import { AdminCategoriesView } from "@/components/storefront/AdminCategoriesView";

export const metadata: Metadata = {
  title: "Admin · Categories · Ramachandra Traders",
};

export default function AdminCategoriesPage() {
  return <AdminCategoriesView />;
}
