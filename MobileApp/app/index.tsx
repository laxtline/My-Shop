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
import type { Paginated, Product } from "@shared/types";
import { apiFetch, formatINR } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { useBrandContext, useBrandReady } from "@/context/BrandContext";
import { colors, radius, spacing } from "@/lib/theme";
import { Text } from "@/components/ui/Typography";
import { Footer } from "@/components/ui/Footer";

export default function HomeScreen() {
  const router = useRouter();
  const { count } = useCart();
  const { loading: brandLoading } = useBrandContext();
  const brand = useBrandReady();
  const [products, setProducts] = useState<Product[]>([]);
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

  const loadProducts = useCallback(
    async (page = 1, cursor?: string, isRefresh = false) => {
      if (!isRefresh) setLoading(true);
      setError(null);
      try {
        let url = `/api/products?limit=20&sort=newest&page=${page}`;
        if (cursor) url += `&cursor=${cursor}`;
        const data = await apiFetch<Paginated<Product>>(url);
        if (page === 1 || isRefresh) {
          setProducts(data.items);
        } else {
          setProducts((prev) => [...prev, ...data.items]);
        }
        setPagination({
          page: data.page,
          limit: data.limit,
          total: data.total,
          totalPages: data.totalPages,
          nextCursor: data.nextCursor ?? null,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load products");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadProducts(1, undefined, true);
  };

  const onEndReached = () => {
    if (pagination && pagination.page < pagination.totalPages && !loading && !refreshing) {
      loadProducts(pagination.page + 1, pagination.nextCursor ?? undefined);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Show branded splash/loading screen while brand or products are loading
  if (brandLoading || loading) {
    return (
      <View style={styles.splashContainer}>
        {brand.logoUrl && (
          <Image
            source={{ uri: brand.logoUrl }}
            style={styles.splashLogo}
            resizeMode="contain"
          />
        )}
        <Text style={styles.splashTitle}>{brand.appName}</Text>
        <Text style={styles.splashSubtitle}>{brand.tagline}</Text>
        <ActivityIndicator size="large" color={colors.brand} style={{ marginTop: spacing.lg }} />
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
        contentContainerStyle={{ padding: spacing.sm, paddingBottom: spacing.xl }}
        columnWrapperStyle={{ gap: spacing.sm }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>{brand.tagline}</Text>
            <Text style={styles.heroSub}>{brand.appName}</Text>
          </View>
        }
        renderItem={({ item }) => <ProductCard product={item} />}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListFooterComponent={
          loading && products.length > 0 ? (
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

  // Splash/loading screen
  splashContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
    padding: spacing.xl,
  },
  splashLogo: {
    width: 120,
    height: 120,
    borderRadius: radius.xl,
    backgroundColor: colors.card,
  },
  splashTitle: {
    marginTop: spacing.lg,
    fontSize: 24,
    fontWeight: "700",
    color: colors.text,
  },
  splashSubtitle: {
    marginTop: spacing.xs,
    fontSize: 16,
    color: colors.textMuted,
  },
  loadingFooter: { padding: spacing.lg, alignItems: "center" },
});
