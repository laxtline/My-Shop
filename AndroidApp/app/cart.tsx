import { FlatList, Image, Linking, Pressable, StyleSheet, View } from "react-native";
import { useState } from 'react';
import { Text } from "@/components/ui/Typography";
import { useRouter } from "expo-router";
import { formatINR, STOREFRONT_URL } from "@/lib/api";
import { QuantitySelector } from '@/components/ui/QuantitySelector';
import { imageUrl } from '@shared/images';
import { unitPriceForQty } from '@shared/pricing';
import { useCart } from "@/lib/cart";
import { colors, radius, spacing } from "@/lib/theme";
import { Footer } from "@/components/ui/Footer";

export default function CartScreen() {
  const router = useRouter();
  const { lines, total, remove, update } = useCart();
  const [error, setError] = useState('');

  if (lines.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyIcon}>🛒</Text>
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <Pressable style={styles.button} onPress={() => router.replace("/")}>
          <Text style={styles.buttonText}>Browse products</Text>
        </Pressable>
        <Footer />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={lines}
        keyExtractor={(l) => l.product.id}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Image
              source={{ uri: imageUrl(item.product.images?.[0] ?? '', 128, 128) }}
              style={styles.thumb}
            />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={2} style={styles.title}>
                {item.product.title}
              </Text>
              <Text style={styles.meta}>
                {formatINR(unitPriceForQty(item.product, item.quantity))} × {item.quantity}
              </Text>
              <QuantitySelector value={item.quantity} max={item.product.stock} onChange={(quantity) => update(item.product.id, quantity)} />
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
          onPress={async () => {
            try {
              const url = new URL('/checkout', STOREFRONT_URL);
              url.searchParams.set('mobileCart', JSON.stringify(lines.map((line) => ({ productId: line.product.id, quantity: line.quantity }))));
              await Linking.openURL(url.toString());
            } catch { setError('Online checkout could not be opened. Please try again.'); }
          }}
        >
          <Text style={styles.buttonText}>Continue to secure checkout</Text>
        </Pressable>
        <Text style={styles.meta}>Sign in on the website to review delivery, apply a coupon and place your order. Your cart stays here.</Text>
        {!!error && <Text accessibilityRole="alert" style={{ color: colors.red }}>{error}</Text>}
      </View>
      <Footer />
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
