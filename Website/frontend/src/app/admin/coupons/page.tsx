import type { Metadata } from "next";
import { AdminCouponsView } from "@/components/storefront/AdminCouponsView";

export const metadata: Metadata = {
  title: "Admin · Coupons · Ramachandra Traders",
};

export default function AdminCouponsPage() {
  return <AdminCouponsView />;
}
