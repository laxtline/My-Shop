import type { Metadata } from "next";
import { BrandManagementPage } from "@/components/storefront/BrandManagement";

export const metadata: Metadata = {
  title: "Brand Settings · Admin · Ramachandra Traders",
};

export default function BrandSettingsPage() {
  return <BrandManagementPage />;
}