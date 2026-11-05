import type { OrderStatus } from "@shared/types";
import { Badge } from "@/components/ui/Badge";

const TONE: Record<OrderStatus, "amber" | "brand" | "emerald" | "red" | "slate"> = {
  PLACED: "amber",
  CONFIRMED: "brand",
  PACKED: "brand",
  SHIPPED: "brand",
  OUT_FOR_DELIVERY: "brand",
  DELIVERED: "emerald",
  CANCELLED: "red",
};

const LABEL: Record<OrderStatus, string> = {
  PLACED: "Placed",
  CONFIRMED: "Confirmed",
  PACKED: "Packed",
  SHIPPED: "Shipped",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={TONE[status] ?? "slate"}>{LABEL[status] ?? status}</Badge>;
}
