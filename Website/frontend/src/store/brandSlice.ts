import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { BrandConfig } from "@shared/types";
import { DEFAULT_BRAND } from "@shared/constants";
import { apiFetch } from "@/lib/api";

interface BrandState {
  brand: BrandConfig;
  status: "idle" | "loading" | "ready" | "error";
}

const initialState: BrandState = {
  // Sensible default so first paint never shows empty branding; overwritten by API.
  brand: { ...DEFAULT_BRAND },
  status: "idle",
};

export const fetchBrand = createAsyncThunk("brand/fetch", async () => {
  return apiFetch<BrandConfig>("/api/brand");
});

const brandSlice = createSlice({
  name: "brand",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchBrand.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchBrand.fulfilled, (state, action) => {
        state.brand = action.payload;
        state.status = "ready";
      })
      .addCase(fetchBrand.rejected, (state) => {
        // keep default brand on failure
        state.status = "error";
      });
  },
});

export default brandSlice.reducer;
