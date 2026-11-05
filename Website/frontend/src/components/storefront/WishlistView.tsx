"use client";

import Link from "next/link";
import { useEffect } from "react";
import type { Product } from "@shared/types";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchWishlist } from "@/store/wishlistSlice";
import { ProductCard } from "./ProductCard";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { ProtectedRoute } from "@/components/ProtectedRoute";

/** Grid of saved products, hydrated from the wishlist slice. */
export function WishlistView() {
  return (
    <ProtectedRoute fallback={<SignInPrompt />}>
      <Wishlist />
    </ProtectedRoute>
  );
}

function SignInPrompt() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
      <p className="text-slate-600">Please sign in to view your wishlist.</p>
      <Link href="/" className="mt-3 inline-block font-medium text-brand hover:underline">
        Go home
      </Link>
    </div>
  );
}

function Wishlist() {
  const dispatch = useAppDispatch();
  const { wishlist, status } = useAppSelector((s) => s.wishlist);

  useEffect(() => {
    if (status === "idle") dispatch(fetchWishlist());
  }, [status, dispatch]);

  const products = (wishlist?.items ?? []).filter(
    (it): it is Product => !!it && typeof it !== "string"
  );

  if (status === "loading" && !wishlist) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!products.length) {
    return (
      <EmptyState
        icon="♡"
        title="No saved items yet"
        message="Tap the heart on any product to save it here for later."
        action={
          <Link href="/products">
            <Button>Explore products</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
