import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import type { Product } from "@shared/types";
import { apiFetch, formatINR } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { colors, radius, spacing } from "@/lib/theme";
import { Text } from "@/components/ui/Typography";
import { QuantitySelector } from '@/components/ui/QuantitySelector';
import { imageUrl } from '@shared/images';
import { unitPriceForQty } from '@shared/pricing';
import { Footer } from "@/components/ui/Footer";

export default function ProductScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { add } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    apiFetch<Product>(`/api/products/${slug}`)
      .then(setProduct)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  if (error || !product) {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.red }}>{error ?? "Product not found"}</Text>
      </View>
    );
  }

  const outOfStock = product.stock <= 0;

  return (
    <>
      <Stack.Screen options={{ title: product.title }} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <Image
          source={{ uri: imageUrl(product.images?.[0] ?? '', 960, 960) }}
          style={styles.image}
        />
        <View style={{ padding: spacing.lg }}>
          {!!product.brand && <Text style={styles.brand}>{product.brand}</Text>}
          <Text style={styles.title}>{product.title}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatINR(unitPriceForQty(product, quantity))}</Text>
            {product.mrp > product.price && <Text style={styles.mrp}>{formatINR(product.mrp)}</Text>}
          </View>
          <Text style={styles.rating}>
            ⭐ {product.rating.toFixed(1)} ({product.numReviews} reviews)
          </Text>

          {!!product.description && <Text style={styles.desc}>{product.description}</Text>}
          {!outOfStock && <><QuantitySelector value={quantity} max={product.stock} onChange={setQuantity} />
            <Text>Total: {formatINR(unitPriceForQty(product, quantity) * quantity)}</Text></>}

          <Pressable
            style={[styles.button, outOfStock && styles.buttonDisabled]}
            disabled={outOfStock}
            onPress={() => {
              add(product, quantity);
              router.push("/cart");
            }}
          >
            <Text style={styles.buttonText}>{outOfStock ? "Out of stock" : "Add to cart"}</Text>
          </Pressable>
        </View>
        <Footer />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  image: { width: "100%", aspectRatio: 1, backgroundColor: "#f1f5f9" },
  brand: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  title: { fontSize: 22, fontWeight: "700", color: colors.text, marginTop: spacing.xs },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm, marginTop: spacing.sm },
  price: { fontSize: 26, fontWeight: "800", color: colors.text },
  mrp: { fontSize: 16, color: colors.textMuted, textDecorationLine: "line-through" },
  rating: { marginTop: spacing.sm, color: colors.textMuted },
  desc: { marginTop: spacing.lg, lineHeight: 22, color: "#334155" },
  button: {
    marginTop: spacing.xl,
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: "center",
  },
  buttonDisabled: { backgroundColor: "#94a3b8" },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
