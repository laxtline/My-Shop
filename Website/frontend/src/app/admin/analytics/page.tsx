import type { Metadata } from "next";
import { AdminAnalyticsView } from "@/components/storefront/AdminAnalyticsView";

export const metadata: Metadata = {
  title: "Admin · Analytics · Ramachandra Traders",
};

export default function AdminAnalyticsPage() {
  return <AdminAnalyticsView />;
}
