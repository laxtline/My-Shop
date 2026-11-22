import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import type { Product, Review, Paginated } from "@shared/types";
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
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const [reviewsPagination, setReviewsPagination] = useState<{
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    nextCursor: string | null;
  } | null>(null);

  useEffect(() => {
    apiFetch<Product>(`/api/products/${slug}`)
      .then(setProduct)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [slug]);

  const loadReviews = useCallback(
    async (page = 1, cursor?: string, isRefresh = false) => {
      if (!product) return;
      if (!isRefresh) setReviewsLoading(true);
      setReviewsError(null);
      try {
        let url = `/api/reviews/product/${product.id}?limit=10&page=${page}`;
        if (cursor) url += `&cursor=${cursor}`;
        const data = await apiFetch<Paginated<Review>>(url);
        if (page === 1 || isRefresh) {
          setReviews(data.items);
        } else {
          setReviews((prev) => [...prev, ...data.items]);
        }
        setReviewsPagination({
          page: data.page,
          limit: data.limit,
          total: data.total,
          totalPages: data.totalPages,
          nextCursor: data.nextCursor ?? null,
        });
      } catch (err) {
        setReviewsError(err instanceof Error ? err.message : "Failed to load reviews");
      } finally {
        setReviewsLoading(false);
      }
    },
    [product]
  );

  useEffect(() => {
    if (product) loadReviews();
  }, [product, loadReviews]);

  const onRefreshReviews = () => {
    loadReviews(1, undefined, true);
  };

  const onEndReachedReviews = () => {
    if (reviewsPagination && reviewsPagination.page < reviewsPagination.totalPages && !reviewsLoading) {
      loadReviews(reviewsPagination.page + 1, reviewsPagination.nextCursor ?? undefined);
    }
  };

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
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        refreshControl={<RefreshControl refreshing={reviewsLoading} onRefresh={onRefreshReviews} />}
      >
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

        {/* Reviews Section */}
        <View style={styles.reviewsSection}>
          <View style={styles.reviewsHeader}>
            <Text style={styles.reviewsTitle}>Reviews</Text>
            {product.numReviews > 10 && (
              <Text style={styles.reviewsCount}>{product.numReviews} total</Text>
            )}
          </View>

          {reviewsError ? (
            <View style={styles.reviewsError}>
              <Text style={styles.reviewsErrorText}>{reviewsError}</Text>
              <Pressable style={styles.retryButton} onPress={onRefreshReviews}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {reviews.length === 0 ? (
                <Text style={styles.noReviews}>No reviews yet. Be the first to review!</Text>
              ) : (
                <>
                  {reviews.map((review, index) => (
                    <View key={review.id} style={styles.reviewCard}>
                      <View style={styles.reviewHeader}>
                        {review.userPicture && (
                          <Image
                            source={{ uri: review.userPicture }}
                            style={styles.reviewAvatar}
                          />
                        )}
                        <View style={styles.reviewUserInfo}>
                          <Text style={styles.reviewUserName}>{review.userName}</Text>
                          <View style={styles.reviewMeta}>
                            <Text style={styles.reviewRating}>
                              {"⭐".repeat(review.rating)}
                            </Text>
                            <Text style={styles.reviewDate}>
                              {new Date(review.createdAt!).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </Text>
                          </View>
                        </View>
                      </View>
                      {review.comment && <Text style={styles.reviewComment}>{review.comment}</Text>}
                    </View>
                  ))}

                  {reviewsPagination && reviewsPagination.page < reviewsPagination.totalPages && (
                    <Pressable
                      style={styles.loadMoreButton}
                      onPress={onEndReachedReviews}
                      disabled={reviewsLoading}
                    >
                      <Text style={styles.loadMoreButtonText}>
                        {reviewsLoading ? "Loading..." : "Load More Reviews"}
                      </Text>
                    </Pressable>
                  )}
                </>
              )}
            </>
          )}
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

  // Reviews styles
  reviewsSection: { marginTop: spacing.xl, paddingHorizontal: spacing.lg },
  reviewsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  reviewsTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  reviewsCount: { fontSize: 13, color: colors.textMuted },
  noReviews: { textAlign: "center", color: colors.textMuted, padding: spacing.xl },
  reviewsError: { alignItems: "center", padding: spacing.xl },
  reviewsErrorText: { color: colors.red, marginBottom: spacing.md, textAlign: "center" },
  retryButton: { backgroundColor: colors.brand, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  retryButtonText: { color: "#fff", fontWeight: "600" },
  reviewCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  reviewHeader: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.xs },
  reviewAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.border },
  reviewUserInfo: { flex: 1, justifyContent: "center" },
  reviewUserName: { fontSize: 14, fontWeight: "600", color: colors.text },
  reviewMeta: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs },
  reviewRating: { fontSize: 12 },
  reviewDate: { fontSize: 11, color: colors.textMuted },
  reviewComment: { fontSize: 13, color: colors.text, lineHeight: 20 },
  loadMoreButton: { marginTop: spacing.md, padding: spacing.md, backgroundColor: colors.bg, borderRadius: radius.md, alignItems: "center", borderWidth: 1, borderColor: colors.border },
  loadMoreButtonText: { fontSize: 14, fontWeight: "600", color: colors.brand },
});
