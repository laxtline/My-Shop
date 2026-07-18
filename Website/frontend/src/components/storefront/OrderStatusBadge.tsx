import type { OrderStatus } from "@shared/types";
import { Badge } from "@/components/ui/Badge";

const TONE: Record<OrderStatus, "amber" | "brand" | "emerald" | "red" | "slate"> = {
  PLACED: "amber",
  CONFIRMED: "brand",
  SHIPPED: "brand",
  DELIVERED: "emerald",
  CANCELLED: "red",
};

const LABEL: Record<OrderStatus, string> = {
  PLACED: "Placed",
  CONFIRMED: "Confirmed",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={TONE[status] ?? "slate"}>{LABEL[status] ?? status}</Badge>;
}
