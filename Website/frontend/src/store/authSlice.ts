import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { googleLogout } from "@react-oauth/google";
import type { User } from "@shared/types";
import { apiFetch } from "@/lib/api";
import { hasGuestSession, saveGuestSession } from "@/lib/auth-session";
import type { RootState } from "./index";

interface AuthState {
  user: User | null;
  status: "bootstrapping" | "anonymous" | "authenticated" | "authenticating" | "signing-out";
  isGuest: boolean;
  sessionRequestId: string | null;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  status: "bootstrapping",
  isGuest: false,
  sessionRequestId: null,
  error: null,
};

/** Check the backend session once. Its cookie may live on a different domain. */
export const fetchMe = createAsyncThunk(
  "auth/me",
  async (_, { rejectWithValue }) => {
    if (hasGuestSession()) return null;
    try {
      const data = await apiFetch<{ user: User }>("/api/auth/me");
      return data.user;
    } catch {
      return rejectWithValue("no-session");
    }
  },
  {
    condition: (_, { getState }) => {
      const auth = (getState() as RootState).auth;
      return auth.status === "bootstrapping" && !auth.sessionRequestId;
    },
  }
);

export const loginWithGoogle = createAsyncThunk(
  "auth/google",
  async (credential: string, { rejectWithValue }) => {
    try {
      const data = await apiFetch<{ user: User }>("/api/auth/google", {
        method: "POST",
        body: JSON.stringify({ credential }),
      });
      saveGuestSession(false);
      return data.user;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : "Login failed");
    }
  },
  { condition: (_, { getState }) => !["authenticating", "signing-out"].includes((getState() as RootState).auth.status) }
);

export const logout = createAsyncThunk(
  "auth/logout",
  async (_, { getState, rejectWithValue }) => {
    try {
      if ((getState() as RootState).auth.user) {
        await apiFetch("/api/auth/logout", { method: "POST" });
      }
      saveGuestSession(false);
      googleLogout();
    } catch (err) {
      // Keep the session visible on failure so a refresh cannot silently sign back in.
      return rejectWithValue(err instanceof Error ? err.message : "Logout failed. Please try again.");
    }
  },
  { condition: (_, { getState }) => !["bootstrapping", "authenticating", "signing-out"].includes((getState() as RootState).auth.status) }
);

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<User>) {
      state.user = action.payload;
    },
    continueAsGuest(state) {
      if (state.user || ["bootstrapping", "authenticating", "signing-out"].includes(state.status)) return;
      state.isGuest = true;
      state.status = "anonymous";
      state.error = null;
    },
    setAuthError(state, action: PayloadAction<string>) {
      state.error = action.payload;
      state.status = state.user ? "authenticated" : "anonymous";
    },
    clearAuthError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMe.pending, (state, action) => {
        state.sessionRequestId = action.meta.requestId;
      })
      .addCase(fetchMe.fulfilled, (state, action) => {
        if (state.sessionRequestId !== action.meta.requestId) return;
        state.sessionRequestId = null;
        state.user = action.payload;
        state.isGuest = !action.payload;
        state.status = action.payload ? "authenticated" : "anonymous";
      })
      .addCase(fetchMe.rejected, (state, action) => {
        if (state.sessionRequestId !== action.meta.requestId) return;
        state.sessionRequestId = null;
        state.user = null;
        state.isGuest = false;
        state.status = "anonymous";
      })
      .addCase(loginWithGoogle.pending, (state) => {
        state.sessionRequestId = null;
        state.status = "authenticating";
        state.error = null;
      })
      .addCase(loginWithGoogle.fulfilled, (state, action) => {
        state.user = action.payload;
        state.isGuest = false;
        state.status = "authenticated";
      })
      .addCase(loginWithGoogle.rejected, (state, action) => {
        state.status = state.user ? "authenticated" : "anonymous";
        state.error = (action.payload as string) ?? "Login failed";
      })
      .addCase(logout.pending, (state) => {
        state.sessionRequestId = null;
        state.status = "signing-out";
        state.error = null;
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.isGuest = false;
        state.status = "anonymous";
        state.error = null;
      })
      .addCase(logout.rejected, (state, action) => {
        state.status = state.user ? "authenticated" : "anonymous";
        state.error = (action.payload as string) ?? "Logout failed. Please try again.";
      });
  },
});

export const { setUser, continueAsGuest, setAuthError, clearAuthError } = authSlice.actions;
export default authSlice.reducer;
