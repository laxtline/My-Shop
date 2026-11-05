import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { OrderTracking, OrderStatus, OrderItem } from "@shared/types";
import { apiFetch, formatINR } from "@/lib/api";
import { colors, radius, spacing } from "@/lib/theme";
import { imageUrl } from '@shared/images';
import { Footer } from "@/components/ui/Footer";

const STATUS_ORDER: OrderStatus[] = [
  "PLACED", "CONFIRMED", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED",
];

const STATUS_LABELS: Record<OrderStatus, string> = {
  PLACED: "Order Placed",
  CONFIRMED: "Confirmed",
  PACKED: "Packed",
  SHIPPED: "Shipped",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  // TODO: sync with web STATUS_LABELS
};

export default function TrackOrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [tracking, setTracking] = useState<OrderTracking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      setError(null);
      const data = await apiFetch<OrderTracking>(`/api/orders/${id}/track`);
      // console.log('[TrackOrderScreen] loaded:', data.orderId);
      setTracking(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tracking");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  if (error || !tracking) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error ?? "Order not found"}</Text>
        <Pressable style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Back to orders</Text>
        </Pressable>
      </View>
    );
  }

  // Build status steps
  const steps = STATUS_ORDER.map((status) => {
    const historyEntry = tracking.statusHistory.find((h) => h.status === status);
    const completed = historyEntry !== undefined;
    const current = status === tracking.status && !["DELIVERED", "CANCELLED"].includes(tracking.status);
    return {
      label: STATUS_LABELS[status],
      status,
      completed,
      current,
      timestamp: historyEntry?.timestamp,
      note: historyEntry?.note,
    };
  });

  if (tracking.status === "CANCELLED") {
    steps.push({
      label: "Cancelled",
      status: "CANCELLED",
      completed: true,
      current: true,
      timestamp: tracking.statusHistory.find((h) => h.status === "CANCELLED")?.timestamp,
      note: tracking.statusHistory.find((h) => h.status === "CANCELLED")?.note,
    });
  }

  const formatDateTime = (iso?: string) => {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleString("en-IN", {
        day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
      });
    } catch { return iso; }
  };

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: spacing.xl }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={{ padding: spacing.lg }}>
        <View style={styles.header}>
          <Text style={styles.title}>Track Order</Text>
          <Text style={styles.subtitle}>#{id.slice(-8).toUpperCase()}</Text>
        </View>

        <View style={styles.statusRow}>
          <View style={[styles.badge, { backgroundColor: tracking.status === "DELIVERED" ? colors.emerald : tracking.status === "CANCELLED" ? colors.red : colors.brand }]}>
            <Text style={styles.badgeText}>{STATUS_LABELS[tracking.status]}</Text>
          </View>
          {tracking.courier.name && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>📦 {tracking.courier.name}</Text>
            </View>
          )}
          {tracking.courier.trackingId && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>#{tracking.courier.trackingId}</Text>
            </View>
          )}
        </View>

        {/* Timeline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Timeline</Text>
          <View style={styles.timeline}>
            {steps.map((step, index) => (
              <View key={step.status} style={styles.timelineItem}>
                <View style={styles.timelineDotContainer}>
                  <View
                    style={[
                      styles.timelineDot,
                      {
                        backgroundColor: step.completed || step.current ? colors.brand : colors.border,
                        borderColor: step.completed || step.current ? colors.brand : colors.border,
                      },
                    ]}
                  >
                    {step.completed && <Text style={styles.checkmark}>✓</Text>}
                    {step.current && !step.completed && <View style={styles.pulse} />}
                  </View>
                  {index < steps.length - 1 && <View style={styles.timelineLine} />}
                </View>
                <View style={styles.timelineContent}>
                  <Text style={[
                    styles.timelineLabel,
                    step.current ? { color: colors.brand } : step.completed ? { color: colors.text } : { color: colors.textMuted },
                  ]}>
                    {step.label}
                  </Text>
                  {step.timestamp && (
                    <Text style={styles.timelineTime}>{formatDateTime(step.timestamp)}</Text>
                  )}
                  {step.note && step.note !== `Status changed to ${step.status}` && (
                    <Text style={styles.timelineNote}>{step.note}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Courier Tracking */}
        {tracking.courier.trackingId && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Courier Tracking</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Courier:</Text>
              <Text style={styles.infoValue}>{tracking.courier.name || "Not assigned"}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Tracking ID:</Text>
              <Text style={styles.infoValue} numberOfLines={1}>{tracking.courier.trackingId}</Text>
            </View>
            {tracking.trackingUrl && (
              <Pressable style={styles.trackButton} onPress={() => Linking.openURL(tracking.trackingUrl!)}>
                <Text style={styles.trackButtonText}>Open Courier Tracking Page</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Shipping Address */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shipping Address</Text>
          <Text style={styles.addressLine}>{tracking.shippingAddress.fullName}</Text>
          <Text style={styles.addressLine}>{tracking.shippingAddress.phone}</Text>
          <Text style={styles.addressLine}>{tracking.shippingAddress.line1}</Text>
          {tracking.shippingAddress.line2 && <Text style={styles.addressLine}>{tracking.shippingAddress.line2}</Text>}
          <Text style={styles.addressLine}>
            {tracking.shippingAddress.city}, {tracking.shippingAddress.state} — {tracking.shippingAddress.pincode}
          </Text>
        </View>

        {/* Order Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Items</Text>
          {tracking.items.map((item: OrderItem, index: number) => (
            <View key={index} style={styles.itemRow}>
              <View style={styles.itemThumb} />
              <View style={styles.itemInfo}>
                <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.itemMeta}>Qty: {item.quantity} × {formatINR(item.unitPrice)}</Text>
              </View>
              <Text style={styles.itemTotal}>{formatINR(item.lineTotal)}</Text>
            </View>
          ))}
          <View style={styles.orderTotal}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatINR(tracking.total)}</Text>
          </View>
        </View>

        {/* Return Status */}
        {tracking.returnRequest && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Return Status</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status:</Text>
              <View style={[styles.badge, { backgroundColor: tracking.returnRequest.status === "REFUNDED" ? colors.emerald : colors.brand }]}>
                <Text style={styles.badgeText}>{tracking.returnRequest.status}</Text>
              </View>
            </View>
            {tracking.returnRequest.reason && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Reason:</Text>
                <Text style={styles.infoValue}>{tracking.returnRequest.reason}</Text>
              </View>
            )}
            {tracking.returnRequest.requestedAt && (
              <Text style={styles.infoValue}>
                Requested on {new Date(tracking.returnRequest.requestedAt).toLocaleDateString("en-IN", {
                  day: "numeric", month: "long", year: "numeric",
                })}
              </Text>
            )}
          </View>
        )}

        {/* Refund Status */}
        {tracking.refund && tracking.refund.status !== "PENDING" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Refund Status</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status:</Text>
              <View style={[styles.badge, { backgroundColor: tracking.refund.status === "COMPLETED" ? colors.emerald : colors.red }]}>
                <Text style={styles.badgeText}>{tracking.refund.status}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Amount:</Text>
              <Text style={styles.infoValue}>{formatINR(tracking.refund.amount)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Method:</Text>
              <Text style={styles.infoValue}>{tracking.refund.method}</Text>
            </View>
          </View>
        )}

        {/* Support */}
        <View style={styles.support}>
          <Text style={styles.supportText}>Need help? Contact support at</Text>
          <Pressable onPress={() => Linking.openURL(`tel:${tracking.shippingAddress.phone}`)}>
            <Text style={styles.supportPhone}>{tracking.shippingAddress.phone}</Text>
          </Pressable>
        </View>
      </View>
      <Footer />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  error: { color: colors.red, marginBottom: spacing.md, textAlign: "center" },
  button: { backgroundColor: colors.brand, borderRadius: radius.md, padding: spacing.lg, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  header: { marginBottom: spacing.lg },
  title: { fontSize: 22, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: spacing.xs },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.lg },
  badge: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.sm },
  badgeText: { color: "#fff", fontWeight: "600", fontSize: 12 },
  section: { marginBottom: spacing.lg, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: spacing.md },
  timeline: { paddingLeft: spacing.md },
  timelineItem: { flexDirection: "row", marginBottom: spacing.xl, minHeight: 40 },
  timelineDotContainer: { width: 24, alignItems: "center" },
  timelineDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 3, justifyContent: "center", alignItems: "center" },
  checkmark: { color: "#fff", fontSize: 10, fontWeight: "bold", marginTop: 1 },
  pulse: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 8, backgroundColor: colors.brand, opacity: 0.5 },
  timelineLine: { position: "absolute", top: 20, bottom: 0, left: 7, width: 2, backgroundColor: colors.border },
  timelineContent: { flex: 1, marginLeft: spacing.md, paddingTop: 2 },
  timelineLabel: { fontSize: 14, fontWeight: "600" },
  timelineTime: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  timelineNote: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, marginBottom: spacing.sm },
  infoLabel: { fontSize: 13, fontWeight: "600", color: colors.textMuted, minWidth: 80 },
  infoValue: { fontSize: 13, color: colors.text, flex: 1 },
  trackButton: { marginTop: spacing.md, backgroundColor: colors.brand, borderRadius: radius.md, padding: spacing.md, alignItems: "center" },
  trackButtonText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  addressLine: { fontSize: 13, color: colors.text, marginBottom: spacing.xs },
  itemRow: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  itemThumb: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.border },
  itemInfo: { flex: 1, justifyContent: "center" },
  itemTitle: { fontSize: 13, fontWeight: "600", color: colors.text },
  itemMeta: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs },
  itemTotal: { fontSize: 13, fontWeight: "700", color: colors.text, marginLeft: spacing.md },
  orderTotal: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  totalLabel: { fontSize: 14, fontWeight: "600", color: colors.text },
  totalValue: { fontSize: 16, fontWeight: "800", color: colors.text },
  support: { marginTop: spacing.xl, padding: spacing.lg, backgroundColor: colors.bg, borderRadius: radius.lg, alignItems: "center", borderWidth: 1, borderColor: colors.border },
  supportText: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.xs },
  supportPhone: { fontSize: 15, fontWeight: "600", color: colors.brand },
});