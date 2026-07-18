import type { Metadata } from "next";
import { InvoiceView } from "@/components/storefront/InvoiceView";

export const metadata: Metadata = {
  title: "Invoice · Ramachandra Traders",
};

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InvoiceView id={id} />;
}
