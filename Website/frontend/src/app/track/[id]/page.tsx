import { Metadata } from "next";
import { notFound } from "next/navigation";
import { TrackOrderView } from "@/components/storefront/TrackOrderView";

export const metadata: Metadata = {
  title: "Track Order",
  robots: { index: false, follow: false },
};

interface TrackOrderPageProps {
  params: Promise<{ id: string }>;
}

export default async function TrackOrderPage({ params }: TrackOrderPageProps) {
  const { id } = await params;
  return <TrackOrderView orderId={id} />;
}