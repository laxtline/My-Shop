import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { Order, Paginated, PaymentMethod, ShippingAddress } from "@shared/types";
import { apiFetch } from "@/lib/api";

interface OrdersState {
  list: Order[];
  listStatus: "idle" | "loading" | "ready" | "error";
  current: Order | null;
  currentStatus: "idle" | "loading" | "ready" | "error";
  placing: boolean;
  error: string | null;
}

const initialState: OrdersState = {
  list: [],
  listStatus: "idle",
  current: null,
  currentStatus: "idle",
  placing: false,
  error: null,
};

export const placeOrder = createAsyncThunk(
  "orders/place",
  async (
    payload: {
      shippingAddress: ShippingAddress;
      paymentMethod?: PaymentMethod;
      notes?: string;
      couponCode?: string;
    },
    { rejectWithValue }
  ) => {
    try {
      return await apiFetch<Order>("/api/orders", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : "Failed to place order");
    }
  }
);

export const fetchMyOrders = createAsyncThunk("orders/mine", async () => {
  const data = await apiFetch<Paginated<Order>>("/api/orders");
  return data.items;
});

export const fetchOrder = createAsyncThunk("orders/one", async (id: string) => {
  return apiFetch<Order>(`/api/orders/${id}`);
});

export const cancelOrder = createAsyncThunk("orders/cancel", async (id: string) => {
  return apiFetch<Order>(`/api/orders/${id}/cancel`, { method: "PATCH" });
});

const ordersSlice = createSlice({
  name: "orders",
  initialState,
  reducers: {
    clearOrders(state) {
      state.list = [];
      state.listStatus = "idle";
      state.current = null;
      state.currentStatus = "idle";
    },
    clearOrderError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // place
      .addCase(placeOrder.pending, (state) => {
        state.placing = true;
        state.error = null;
      })
      .addCase(placeOrder.fulfilled, (state, action) => {
        state.placing = false;
        state.current = action.payload;
        state.list.unshift(action.payload);
      })
      .addCase(placeOrder.rejected, (state, action) => {
        state.placing = false;
        state.error = (action.payload as string) ?? "Failed to place order";
      })
      // my orders
      .addCase(fetchMyOrders.pending, (state) => {
        state.listStatus = "loading";
      })
      .addCase(fetchMyOrders.fulfilled, (state, action) => {
        state.list = action.payload;
        state.listStatus = "ready";
      })
      .addCase(fetchMyOrders.rejected, (state) => {
        state.listStatus = "error";
      })
      // single order
      .addCase(fetchOrder.pending, (state) => {
        state.currentStatus = "loading";
        state.current = null;
      })
      .addCase(fetchOrder.fulfilled, (state, action) => {
        state.current = action.payload;
        state.currentStatus = "ready";
      })
      .addCase(fetchOrder.rejected, (state) => {
        state.currentStatus = "error";
      })
      // cancel — update in place
      .addCase(cancelOrder.fulfilled, (state, action) => {
        state.current = action.payload;
        state.list = state.list.map((o) => (o.id === action.payload.id ? action.payload : o));
      });
  },
});

export const { clearOrders, clearOrderError } = ordersSlice.actions;
export default ordersSlice.reducer;
