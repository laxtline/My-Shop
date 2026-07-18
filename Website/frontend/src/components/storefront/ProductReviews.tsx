"use client";

import { useCallback, useEffect, useState } from "react";
import type { Paginated, Review } from "@shared/types";
import { apiFetch } from "@/lib/api";
import { useAppSelector } from "@/store/hooks";
import { Button } from "@/components/ui/Button";
import { Rating } from "@/components/ui/Rating";
import { Spinner } from "@/components/ui/Spinner";
import { useAuthAction } from "@/components/auth/AuthActionProvider";

export function ProductReviews({ productId }: { productId: string }) {
  const user = useAppSelector((s) => s.auth.user);
  const { promptLogin } = useAuthAction();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Paginated<Review>>(`/api/reviews/product/${productId}`);
      setReviews(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reviews");
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    load();
  }, [load]);

  const myReview = user ? reviews.find((r) => r.user === user.id) : undefined;

  // Prefill the form with the user's existing review when it loads.
  useEffect(() => {
    if (myReview) {
      setRating(myReview.rating);
      setComment(myReview.comment);
    }
  }, [myReview?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    if (!user) {
      promptLogin("Sign in to write a review.");
      return;
    }
    if (rating < 1) {
      setFormError("Please select a star rating.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch<Review>("/api/reviews", {
        method: "POST",
        body: JSON.stringify({ productId, rating, comment }),
      });
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save review");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete your review?")) return;
    try {
      await apiFetch(`/api/reviews/${id}`, { method: "DELETE" });
      setRating(0);
      setComment("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete review");
    }
  };

  return (
    <section>
      <h2 className="text-lg font-bold text-slate-900">
        Reviews{reviews.length > 0 ? ` (${reviews.length})` : ""}
      </h2>

      {/* Write / edit form */}
      <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
        <h3 className="text-sm font-semibold text-slate-800">
          {myReview ? "Edit your review" : "Write a review"}
        </h3>
        <div className="mt-3">
          <StarInput value={rating} onChange={setRating} />
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Share your experience with this product…"
          className="mt-3 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-brand"
        />
        {formError && <p className="mt-2 text-sm text-red-600">{formError}</p>}
        <div className="mt-3 flex items-center gap-3">
          <Button size="sm" onClick={submit} loading={saving}>
            {myReview ? "Update review" : "Submit review"}
          </Button>
          {myReview && (
            <Button size="sm" variant="ghost" onClick={() => remove(myReview.id)}>
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* List */}
      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      {loading ? (
        <div className="grid place-items-center py-10">
          <Spinner className="h-6 w-6" />
        </div>
      ) : reviews.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No reviews yet. Be the first to review this product!</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {reviews.map((r) => (
            <li key={r.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-card">
              <div className="flex items-center gap-3">
                {r.userPicture ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.userPicture} alt="" className="h-9 w-9 rounded-full" />
                ) : (
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                    {r.userName?.[0]?.toUpperCase() ?? "U"}
                  </span>
                )}
                <div>
                  <p className="text-sm font-semibold text-slate-800">{r.userName}</p>
                  <Rating value={r.rating} size="sm" />
                </div>
                {r.createdAt && (
                  <span className="ml-auto text-xs text-slate-400">
                    {new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                )}
              </div>
              {r.comment && <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{r.comment}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Interactive 1-5 star selector. */
function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Your rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
          className="text-2xl leading-none focus-ring rounded"
        >
          <span className={n <= shown ? "text-amber-400" : "text-slate-300"}>★</span>
        </button>
      ))}
    </div>
  );
}
