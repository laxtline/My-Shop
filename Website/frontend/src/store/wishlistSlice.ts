import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { Wishlist } from "@shared/types";
import { apiFetch, ApiError } from "@/lib/api";
import type { RootState } from "./index";

interface WishlistState {
  wishlist: Wishlist | null;
  status: "idle" | "loading" | "ready" | "error";
  mutating: string | null;
}

const initialState: WishlistState = {
  wishlist: null,
  status: "idle",
  mutating: null,
};

export const fetchWishlist = createAsyncThunk("wishlist/fetch", async (_, { rejectWithValue }) => {
  try {
    return await apiFetch<Wishlist>("/api/wishlist");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    return rejectWithValue(err instanceof Error ? err.message : "Failed to load wishlist");
  }
});

export const addToWishlist = createAsyncThunk("wishlist/add", async (productId: string) => {
  return apiFetch<Wishlist>("/api/wishlist/add", {
    method: "POST",
    body: JSON.stringify({ productId }),
  });
});

export const removeFromWishlist = createAsyncThunk("wishlist/remove", async (productId: string) => {
  return apiFetch<Wishlist>(`/api/wishlist/remove/${productId}`, { method: "DELETE" });
});

const wishlistSlice = createSlice({
  name: "wishlist",
  initialState,
  reducers: {
    clearWishlist(state) {
      state.wishlist = null;
      state.status = "idle";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchWishlist.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchWishlist.fulfilled, (state, action) => {
        state.wishlist = action.payload;
        state.status = "ready";
      })
      .addCase(fetchWishlist.rejected, (state) => {
        state.status = "error";
      });

    for (const thunk of [addToWishlist, removeFromWishlist]) {
      builder
        .addCase(thunk.pending, (state, action) => {
          state.mutating = action.meta.arg;
        })
        .addCase(thunk.fulfilled, (state, action) => {
          state.wishlist = action.payload;
          state.status = "ready";
          state.mutating = null;
        })
        .addCase(thunk.rejected, (state) => {
          state.mutating = null;
        });
    }
  },
});

export const { clearWishlist } = wishlistSlice.actions;
export default wishlistSlice.reducer;

// ---- selectors ----
function wishlistIds(state: RootState): string[] {
  const items = state.wishlist.wishlist?.items ?? [];
  return items.map((it) => (typeof it === "string" ? it : it.id));
}

export const selectWishlistCount = (state: RootState): number => wishlistIds(state).length;

export const selectIsWishlisted = (productId: string) => (state: RootState): boolean =>
  wishlistIds(state).includes(productId);
