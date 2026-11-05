import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { Cart } from '@shared/types';
import { apiFetch, ApiError } from '@/lib/api';
import type { RootState } from './index';

interface CartState {
  cart: Cart | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  // productId currently being mutated (for per-item spinners).
  mutating: string | null;
  error: string | null;
  previousQuantity: { productId: string; quantity: number } | null;
}

const initialState: CartState = {
  cart: null,
  status: 'idle',
  mutating: null,
  error: null,
  previousQuantity: null,
};

// Load the signed-in user's cart. Silently no-ops (empty) when unauthenticated.
export const fetchCart = createAsyncThunk('cart/fetch', async (_, { rejectWithValue }) => {
  try {
    return await apiFetch<Cart>('/api/cart');
  } catch (err) {
    // 401 = not logged in: treat as an empty cart rather than an error.
    if (err instanceof ApiError && err.status === 401) return null;
    return rejectWithValue(err instanceof Error ? err.message : 'Failed to load cart');
  }
});

export const addToCart = createAsyncThunk(
  'cart/add',
  async ({ productId, quantity = 1 }: { productId: string; quantity?: number }) => {
    return apiFetch<Cart>('/api/cart/add', {
      method: 'POST',
      body: JSON.stringify({ productId, quantity }),
    });
  },
  { condition: (_, { getState }) => !(getState() as RootState).cart.mutating }
);

export const updateCartItem = createAsyncThunk(
  'cart/update',
  async ({ productId, quantity }: { productId: string; quantity: number }) => {
    return apiFetch<Cart>('/api/cart/update', {
      method: 'PUT',
      body: JSON.stringify({ productId, quantity }),
    });
  },
  { condition: (_, { getState }) => !(getState() as RootState).cart.mutating }
);

export const removeFromCart = createAsyncThunk('cart/remove', async (productId: string) => {
  return apiFetch<Cart>(`/api/cart/remove/${productId}`, { method: 'DELETE' });
}, { condition: (_, { getState }) => !(getState() as RootState).cart.mutating });

export const mergeMobileCart = createAsyncThunk('cart/mergeMobile', async (items: { productId: string; quantity: number }[]) =>
  apiFetch<Cart>('/api/cart/merge', { method: 'POST', body: JSON.stringify({ items }) }));

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    clearCart(state) {
      state.cart = null;
      state.status = 'idle';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCart.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchCart.fulfilled, (state, action) => {
        if (!state.mutating) state.cart = action.payload;
        state.status = 'ready';
      })
      .addCase(fetchCart.rejected, (state) => {
        state.status = 'error';
      })
      .addCase(mergeMobileCart.pending, (state) => { state.mutating = 'mobile-import'; state.error = null; })
      .addCase(mergeMobileCart.fulfilled, (state, action) => { state.cart = action.payload; state.status = 'ready'; state.mutating = null; })
      .addCase(mergeMobileCart.rejected, (state, action) => { state.error = action.error.message ?? 'Could not transfer mobile cart.'; state.mutating = null; });

    // add / update / remove all return the fresh populated cart.
    for (const thunk of [addToCart, updateCartItem, removeFromCart]) {
      builder
        .addCase(thunk.pending, (state, action) => {
          state.error = null;
          state.previousQuantity = null;
          state.mutating =
            typeof action.meta.arg === 'string'
              ? action.meta.arg
              : (action.meta.arg as { productId: string }).productId;
          if (action.type === updateCartItem.pending.type) {
            const arg = action.meta.arg as { productId: string; quantity: number };
            const item = state.cart?.items.find((i) => i.product && (typeof i.product === 'string' ? i.product : i.product.id) === arg.productId);
            if (item) {
              state.previousQuantity = { productId: arg.productId, quantity: item.quantity };
              item.quantity = arg.quantity;
            }
          }
        })
        .addCase(thunk.fulfilled, (state, action) => {
          state.cart = action.payload;
          state.status = 'ready';
          state.mutating = null;
          state.previousQuantity = null;
        })
        .addCase(thunk.rejected, (state, action) => {
          if (state.previousQuantity) {
            const previous = state.previousQuantity;
            const item = state.cart?.items.find((i) => i.product && (typeof i.product === 'string' ? i.product : i.product.id) === previous.productId);
            if (item) item.quantity = previous.quantity;
          }
          state.previousQuantity = null;
          state.error = action.error.message ?? 'Cart update failed';
          state.mutating = null;
        });
    }
  },
});

export const { clearCart } = cartSlice.actions;
export default cartSlice.reducer;

// ---- selectors ----
function items(state: RootState) {
  return state.cart.cart?.items ?? [];
}

// Total number of units across all lines (for the header badge).
export const selectCartCount = (state: RootState): number =>
  items(state).reduce((n, it) => n + it.quantity, 0);

// True if the given product id is in the cart.
export const selectIsInCart = (productId: string) => (state: RootState): boolean =>
  items(state).some((it) => {
    // `product` is null when the referenced product no longer exists — populate
    // resolves a dangling reference to null, and `typeof null` is "object".
    if (!it.product) return false;
    return typeof it.product === 'string' ? it.product === productId : it.product.id === productId;
  });
