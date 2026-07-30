"use client";

import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { addToWishlist, removeFromWishlist, selectIsWishlisted } from "@/store/wishlistSlice";
import { useAuthAction } from "@/components/auth/AuthActionProvider";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

/** Heart toggle that saves/removes a product from the wishlist (auth-gated). */
export function WishlistButton({
  productId,
  className,
  size = "md",
}: {
  productId: string;
  className?: string;
  size?: "md" | "lg";
}) {
  const dispatch = useAppDispatch();
  const { requireAuth } = useAuthAction();
  const { toast } = useToast();
  const wishlisted = useAppSelector(selectIsWishlisted(productId));
  const busy = useAppSelector((s) => s.wishlist.mutating === productId);

  const toggle = () =>
    requireAuth(async () => {
      // Read the flag before dispatching — the store flips it once the thunk
      // settles, so checking afterwards would report the wrong message.
      const wasWishlisted = wishlisted;
      await dispatch(wasWishlisted ? removeFromWishlist(productId) : addToWishlist(productId));
      toast(wasWishlisted ? "Removed from wishlist" : "Saved to wishlist");
    }, "Sign in to save items to your wishlist");

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={wishlisted}
      aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
      className={cn(
        "grid place-items-center rounded-full bg-white/90 shadow-sm backdrop-blur transition hover:scale-105 focus-ring disabled:opacity-50",
        size === "lg" ? "h-11 w-11 text-2xl" : "h-9 w-9 text-lg",
        wishlisted ? "text-red-500" : "text-slate-400 hover:text-red-400",
        className
      )}
    >
      {wishlisted ? "♥" : "♡"}
    </button>
  );
}
