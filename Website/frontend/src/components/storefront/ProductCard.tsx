"use client";

import Link from "next/link";
import type { Product } from "@shared/types";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { addToCart, selectIsInCart } from "@/store/cartSlice";
import { useAuthAction } from "@/components/auth/AuthActionProvider";
import { Button } from "@/components/ui/Button";
import { Price } from "@/components/ui/Price";
import { Rating } from "@/components/ui/Rating";
import { Badge } from "@/components/ui/Badge";
import { primaryImage } from "@/lib/format";
import { WishlistButton } from "./WishlistButton";

/** Product tile used across grids and rails. Handles add-to-cart + wishlist inline. */
export function ProductCard({ product }: { product: Product }) {
  const dispatch = useAppDispatch();
  const { requireAuth } = useAuthAction();
  const inCart = useAppSelector(selectIsInCart(product.id));
  const mutating = useAppSelector((s) => s.cart.mutating === product.id);
  const outOfStock = product.stock <= 0;
  const lowStock = !outOfStock && product.stock <= 10;

  const add = () =>
    requireAuth(
      () => dispatch(addToCart({ productId: product.id, quantity: 1 })),
      "Sign in to add items to your cart"
    );

  return (
    <div className="group relative flex flex-col rounded-2xl border border-slate-100 bg-white p-3 shadow-card transition-shadow hover:shadow-card-hover">
      <div className="absolute right-4 top-4 z-10">
        <WishlistButton productId={product.id} />
      </div>

      <Link href={`/products/${product.slug}`} className="block overflow-hidden rounded-xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={primaryImage(product)}
          alt={product.title}
          loading="lazy"
          className="aspect-square w-full bg-slate-50 object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </Link>

      <div className="mt-3 flex flex-1 flex-col">
        <p className="text-xs font-medium text-slate-400">{product.brand}</p>
        <Link
          href={`/products/${product.slug}`}
          className="mt-0.5 line-clamp-2 text-sm font-semibold text-slate-800 hover:text-brand"
        >
          {product.title}
        </Link>

        <Rating value={product.rating} count={product.numReviews} className="mt-2" />
        <Price price={product.price} mrp={product.mrp} size="sm" className="mt-2" />

        {lowStock && (
          <Badge tone="amber" className="mt-2 self-start">
            Only {product.stock} left
          </Badge>
        )}

        <div className="flex-1" />

        <div className="mt-3">
          {outOfStock ? (
            <Badge tone="red" className="w-full justify-center py-2">
              Out of stock
            </Badge>
          ) : (
            <Button
              variant={inCart ? "secondary" : "primary"}
              size="sm"
              fullWidth
              loading={mutating}
              onClick={add}
            >
              {inCart ? "In cart · Add more" : "Add to cart"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
