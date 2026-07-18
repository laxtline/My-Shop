import { FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { formatINR } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { colors, radius, spacing } from "@/lib/theme";

export default function CartScreen() {
  const router = useRouter();
  const { lines, total, remove, clear } = useCart();

  if (lines.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyIcon}>🛒</Text>
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <Pressable style={styles.button} onPress={() => router.replace("/")}>
          <Text style={styles.buttonText}>Browse products</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={lines}
        keyExtractor={(l) => l.product.id}
        contentContainerStyle={{ padding: spacing.md }}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Image
              source={{ uri: item.product.images?.[0] ?? "https://via.placeholder.com/100" }}
              style={styles.thumb}
            />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={2} style={styles.title}>
                {item.product.title}
              </Text>
              <Text style={styles.meta}>
                {formatINR(item.product.price)} × {item.quantity}
              </Text>
            </View>
            <Pressable onPress={() => remove(item.product.id)}>
              <Text style={styles.remove}>Remove</Text>
            </Pressable>
          </View>
        )}
      />

      <View style={styles.footer}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatINR(total)}</Text>
        </View>
        <Pressable
          style={styles.button}
          onPress={() => {
            // The website performs server-authoritative COD/Razorpay checkout.
            // Wiring login + /api/orders here is the next step (see README).
            clear();
            router.replace("/");
          }}
        >
          <Text style={styles.buttonText}>Checkout (demo)</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: colors.text, marginTop: spacing.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumb: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: "#f1f5f9" },
  title: { fontSize: 14, fontWeight: "600", color: colors.text },
  meta: { marginTop: spacing.xs, color: colors.textMuted, fontSize: 13 },
  remove: { color: colors.red, fontWeight: "600", fontSize: 13 },
  footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md },
  totalLabel: { fontSize: 16, fontWeight: "600", color: colors.text },
  totalValue: { fontSize: 18, fontWeight: "800", color: colors.text },
  button: { backgroundColor: colors.brand, borderRadius: radius.md, padding: spacing.lg, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
