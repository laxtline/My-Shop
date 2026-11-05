import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { Category, Paginated } from "@shared/types";
import { apiFetch } from "@/lib/api";

interface CategoriesState {
  items: Category[];
  status: "idle" | "loading" | "ready" | "error";
}

const initialState: CategoriesState = { items: [], status: "idle" };

export const fetchCategories = createAsyncThunk("categories/fetch", async () => {
  return (await apiFetch<Paginated<Category>>("/api/categories?limit=12&sort=order")).items;
});

const categoriesSlice = createSlice({
  name: "categories",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchCategories.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchCategories.fulfilled, (state, action) => {
        state.items = action.payload;
        state.status = "ready";
      })
      .addCase(fetchCategories.rejected, (state) => {
        state.status = "error";
      });
  },
});

export default categoriesSlice.reducer;
