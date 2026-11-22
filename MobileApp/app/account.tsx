import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/lib/cart";
import { apiFetch, formatINR } from "@/lib/api";
import { colors, radius, spacing } from "@/lib/theme";
import { Text } from "@/components/ui/Typography";
import { Footer } from "@/components/ui/Footer";

export default function AccountScreen() {
  const router = useRouter();
  const { user, loading, signIn, signOut } = useAuth();
  const { count } = useCart();
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  const loadOrders = async () => {
    if (!user) return;
    setOrdersLoading(true);
    setOrdersError(null);
    try {
      const data = await apiFetch<any>("/api/orders?limit=10");
      setOrders(data.items ?? []);
    } catch (err) {
      setOrdersError(err instanceof Error ? err.message : "Failed to load orders");
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [user]);

  const handleSignOut = async () => {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/");
        },
      },
    ]);
  };

  const STATUS_LABELS: Record<string, string> = {
    PLACED: "Order Placed",
    CONFIRMED: "Confirmed",
    PACKED: "Packed",
    SHIPPED: "Shipped",
    OUT_FOR_DELIVERY: "Out for Delivery",
    DELIVERED: "Delivered",
    CANCELLED: "Cancelled",
  };

  const STATUS_COLORS: Record<string, string> = {
    PLACED: colors.brand,
    CONFIRMED: colors.brand,
    PACKED: "#f59e0b",
    SHIPPED: "#3b82f6",
    OUT_FOR_DELIVERY: "#8b5cf6",
    DELIVERED: colors.emerald,
    CANCELLED: colors.red,
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: spacing.xl }}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          {user ? (
            <>
              {user.picture && (
                <Image source={{ uri: user.picture }} style={styles.avatar} />
              )}
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{user.name}</Text>
                <Text style={styles.userEmail}>{user.email}</Text>
              </View>
            </>
          ) : (
            <View style={styles.guestInfo}>
              <Text style={styles.guestTitle}>Welcome Guest</Text>
              <Text style={styles.guestSubtitle}>Sign in to view orders and manage your account</Text>
              <Pressable style={styles.signInButton} onPress={signIn}>
                <Text style={styles.signInButtonText}>Sign in with Google</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>

      {/* Cart Bar */}
      <Pressable style={styles.cartBar} onPress={() => router.push("/cart")}>
        <Text style={styles.cartBarText}>🛒 View cart{count > 0 ? ` (${count})` : ""}</Text>
      </Pressable>

      {/* Orders Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Orders</Text>
          {user && (
            <Pressable onPress={() => router.push("/orders")}>
              <Text style={styles.viewAll}>View All</Text>
            </Pressable>
          )}
        </View>

        {!user ? (
          <Text style={styles.emptyState}>Sign in to view your orders</Text>
        ) : ordersLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.brand} />
          </View>
        ) : ordersError ? (
          <Text style={styles.error}>{ordersError}</Text>
        ) : orders.length === 0 ? (
          <Text style={styles.emptyState}>No orders yet. Start shopping!</Text>
        ) : (
          <View style={styles.ordersList}>
            {orders.map((order) => (
              <Pressable
                key={order.id}
                style={styles.orderCard}
                onPress={() => router.push(`/orders/${order.id}`)}
              >
                <View style={styles.orderHeader}>
                  <Text style={styles.orderId}>#{order.id.slice(-8).toUpperCase()}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[order.status] ?? colors.brand }]}>
                    <Text style={styles.statusBadgeText}>{STATUS_LABELS[order.status] ?? order.status}</Text>
                  </View>
                </View>
                <Text style={styles.orderDate}>
                  {new Date(order.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </Text>
                <Text style={styles.orderTotal}>{formatINR(order.total)}</Text>
                {order.items.length > 0 && (
                  <Text style={styles.orderItems}>
                    {order.items.length} item{order.items.length > 1 ? "s" : ""}
                  </Text>
                )}
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* Account Actions */}
      {user && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <Pressable style={styles.actionRow} onPress={() => router.push("/account/addresses")}>
            <Text style={styles.actionText}>📍 Saved Addresses</Text>
            <Text style={styles.actionArrow}>›</Text>
          </Pressable>
          <Pressable style={styles.actionRow} onPress={() => router.push("/orders")}>
            <Text style={styles.actionText}>📦 My Orders</Text>
            <Text style={styles.actionArrow}>›</Text>
          </Pressable>
          <Pressable style={styles.actionRow} onPress={handleSignOut}>
            <Text style={[styles.actionText, { color: colors.red }]}>🚪 Sign Out</Text>
            <Text style={styles.actionArrow}>›</Text>
          </Pressable>
        </View>
      )}

      <Footer />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  header: {
    backgroundColor: colors.brand,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  headerContent: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#fff" },
  userInfo: { flex: 1 },
  userName: { fontSize: 20, fontWeight: "700", color: "#fff" },
  userEmail: { fontSize: 13, color: "#dbeafe", marginTop: spacing.xs },
  guestInfo: { flex: 1, alignItems: "center" },
  guestTitle: { fontSize: 22, fontWeight: "700", color: "#fff" },
  guestSubtitle: { fontSize: 14, color: "#dbeafe", marginTop: spacing.xs, textAlign: "center" },
  signInButton: {
    marginTop: spacing.md,
    backgroundColor: "#fff",
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  signInButtonText: { color: colors.brand, fontWeight: "700", fontSize: 16 },
  cartBar: { backgroundColor: colors.brandDark, padding: spacing.md, alignItems: "center" },
  cartBarText: { color: "#fff", fontWeight: "600" },
  section: { margin: spacing.lg, padding: spacing.lg, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  viewAll: { fontSize: 13, color: colors.brand, fontWeight: "600" },
  emptyState: { textAlign: "center", color: colors.textMuted, padding: spacing.xl },
  error: { textAlign: "center", color: colors.red, padding: spacing.md },
  ordersList: { gap: spacing.md },
  orderCard: { padding: spacing.md, backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  orderHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xs },
  orderId: { fontSize: 14, fontWeight: "700", color: colors.text },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.sm },
  statusBadgeText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  orderDate: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.xs },
  orderTotal: { fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: spacing.xs },
  orderItems: { fontSize: 12, color: colors.textMuted },
  actionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.md },
  actionText: { fontSize: 15, fontWeight: "500", color: colors.text },
  actionArrow: { fontSize: 18, color: colors.textMuted },
});