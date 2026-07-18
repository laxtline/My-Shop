import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./authSlice";
import brandReducer from "./brandSlice";
import cartReducer from "./cartSlice";
import wishlistReducer from "./wishlistSlice";
import categoriesReducer from "./categoriesSlice";
import ordersReducer from "./ordersSlice";

export const makeStore = () =>
  configureStore({
    reducer: {
      auth: authReducer,
      brand: brandReducer,
      cart: cartReducer,
      wishlist: wishlistReducer,
      categories: categoriesReducer,
      orders: ordersReducer,
    },
  });

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
