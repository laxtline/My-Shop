import type { Metadata } from "next";
import { AccountView } from "@/components/storefront/AccountView";

export const metadata: Metadata = {
  title: "My account · Ramachandra Traders",
};

export default function AccountPage() {
  return <AccountView />;
}
