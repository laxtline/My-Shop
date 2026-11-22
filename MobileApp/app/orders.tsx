import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, formatINR } from "@/lib/api";
import { colors, radius, spacing } from "@/lib/theme";
import { Text } from "@/components/ui/Typography";
import { Footer } from "@/components/ui/Footer";
import { imageUrl } from "@shared/images";
import type { Paginated, Order, OrderStatus } from "@shared/types";

export default function OrdersScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<{
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    nextCursor: string | null;
  } | null>(null);

  const loadOrders = useCallback(
    async (page = 1, cursor?: string, isRefresh = false) => {
      if (!user) return;
      if (!isRefresh) setLoading(true);
      setError(null);
      try {
        let url = `/api/orders?limit=10&page=${page}`;
        if (cursor) url += `&cursor=${cursor}`;
        const data = await apiFetch<Paginated<Order>>(url);
        if (page === 1 || isRefresh) {
          setOrders(data.items);
        } else {
          setOrders((prev) => [...prev, ...data.items]);
        }
        setPagination({
          page: data.page,
          limit: data.limit,
          total: data.total,
          totalPages: data.totalPages,
          nextCursor: data.nextCursor ?? null,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load orders");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user]
  );

  useEffect(() => {
    if (!authLoading) {
      loadOrders();
    }
  }, [authLoading, loadOrders]);

  const onRefresh = () => {
    setRefreshing(true);
    loadOrders(1, undefined, true);
  };

  const onEndReached = () => {
    if (pagination && pagination.page < pagination.totalPages && !loading && !refreshing) {
      loadOrders(pagination.page + 1, pagination.nextCursor ?? undefined);
    }
  };

  const STATUS_LABELS: Record<OrderStatus, string> = {
    PLACED: "Order Placed",
    CONFIRMED: "Confirmed",
    PACKED: "Packed",
    SHIPPED: "Shipped",
    OUT_FOR_DELIVERY: "Out for Delivery",
    DELIVERED: "Delivered",
    CANCELLED: "Cancelled",
  };

  const STATUS_COLORS: Record<OrderStatus, string> = {
    PLACED: colors.brand,
    CONFIRMED: colors.brand,
    PACKED: "#f59e0b",
    SHIPPED: "#3b82f6",
    OUT_FOR_DELIVERY: "#8b5cf6",
    DELIVERED: colors.emerald,
    CANCELLED: colors.red,
  };

  if (authLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Please sign in to view orders</Text>
        <Pressable style={styles.button} onPress={() => router.push("/account")}>
          <Text style={styles.buttonText}>Go to Account</Text>
        </Pressable>
        <Footer />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          !loading && orders.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No orders yet</Text>
              <Text style={styles.emptySubtitle}>Your order history will appear here</Text>
              <Pressable style={styles.button} onPress={() => router.replace("/")}>
                <Text style={styles.buttonText}>Start Shopping</Text>
              </Pressable>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable style={styles.orderCard} onPress={() => router.push(`/orders/${item.id}`)}>
            <View style={styles.orderHeader}>
              <Text style={styles.orderId}>#{item.id.slice(-8).toUpperCase()}</Text>
              <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] ?? colors.brand }]}>
                <Text style={styles.statusBadgeText}>{STATUS_LABELS[item.status]}</Text>
              </View>
            </View>
            <Text style={styles.orderDate}>
              {item.createdAt
                ? new Date(item.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : ""}
            </Text>
            <View style={styles.orderFooter}>
              <Text style={styles.orderTotal}>{formatINR(item.total)}</Text>
              <Text style={styles.orderItems}>
                {item.items.length} item{item.items.length > 1 ? "s" : ""}
              </Text>
            </View>
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListFooterComponent={
          loading && orders.length > 0 ? (
            <View style={styles.loadingFooter}>
              <ActivityIndicator size="small" color={colors.brand} />
            </View>
          ) : (
            <Footer />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  emptyContainer: { alignItems: "center", padding: spacing.xl },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: spacing.xs },
  emptySubtitle: { fontSize: 14, color: colors.textMuted, textAlign: "center", marginBottom: spacing.lg },
  button: { backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  orderCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  orderHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xs },
  orderId: { fontSize: 14, fontWeight: "700", color: colors.text },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.sm },
  statusBadgeText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  orderDate: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm },
  orderFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  orderTotal: { fontSize: 16, fontWeight: "800", color: colors.text },
  orderItems: { fontSize: 12, color: colors.textMuted },
  separator: { height: spacing.md },
  loadingFooter: { padding: spacing.lg, alignItems: "center" },
});