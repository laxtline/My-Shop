import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Link, useRouter } from "expo-router";
import type { Paginated, Product } from "@shared/types";
import { apiFetch, formatINR } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { colors, radius, spacing } from "@/lib/theme";

export default function HomeScreen() {
  const router = useRouter();
  const { count } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await apiFetch<Paginated<Product>>("/api/products?limit=20&sort=newest");
      setProducts(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Cart bar */}
      <Pressable style={styles.cartBar} onPress={() => router.push("/cart")}>
        <Text style={styles.cartBarText}>🛒 View cart{count > 0 ? ` (${count})` : ""}</Text>
      </Pressable>

      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={products}
        keyExtractor={(p) => p.id}
        numColumns={2}
        contentContainerStyle={{ padding: spacing.sm }}
        columnWrapperStyle={{ gap: spacing.sm }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
        ListHeaderComponent={
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>Everything for Your Dream Home</Text>
            <Text style={styles.heroSub}>Tiles · Paints · Electrical · Interiors</Text>
          </View>
        }
        renderItem={({ item }) => <ProductCard product={item} />}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      />
    </View>
  );
}

function ProductCard({ product }: { product: Product }) {
  return (
    <Link href={`/product/${product.slug}`} asChild>
      <Pressable style={styles.card}>
        <Image
          source={{ uri: product.images?.[0] ?? "https://via.placeholder.com/300" }}
          style={styles.cardImage}
        />
        <Text numberOfLines={2} style={styles.cardTitle}>
          {product.title}
        </Text>
        <Text style={styles.cardPrice}>{formatINR(product.price)}</Text>
        {product.stock <= 0 && <Text style={styles.oos}>Out of stock</Text>}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  error: { color: colors.red, padding: spacing.md, textAlign: "center" },
  cartBar: { backgroundColor: colors.brandDark, padding: spacing.md, alignItems: "center" },
  cartBarText: { color: "#fff", fontWeight: "600" },
  hero: {
    backgroundColor: colors.brand,
    borderRadius: radius.lg,
    padding: spacing.xl,
    margin: spacing.sm,
  },
  heroTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  heroSub: { color: "#dbeafe", marginTop: spacing.xs },
  card: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardImage: { width: "100%", aspectRatio: 1, borderRadius: radius.md, backgroundColor: "#f1f5f9" },
  cardTitle: { marginTop: spacing.sm, fontSize: 13, fontWeight: "600", color: colors.text },
  cardPrice: { marginTop: spacing.xs, fontSize: 15, fontWeight: "700", color: colors.text },
  oos: { marginTop: spacing.xs, fontSize: 11, color: colors.red, fontWeight: "600" },
});
