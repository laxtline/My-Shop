import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { User } from "@shared/types";
import { apiFetch } from "@/lib/api";

interface AuthState {
  user: User | null;
  // 'bootstrapping' = checking existing session on load; gate shows splash until done.
  status: "bootstrapping" | "anonymous" | "authenticated" | "authenticating";
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  status: "bootstrapping",
  error: null,
};

/** Check for an existing session (httpOnly cookie) on app load. */
export const fetchMe = createAsyncThunk("auth/me", async (_, { rejectWithValue }) => {
  try {
    const data = await apiFetch<{ user: User }>("/api/auth/me");
    return data.user;
  } catch {
    return rejectWithValue("no-session");
  }
});

/** Exchange a Google ID token credential for a session. */
export const loginWithGoogle = createAsyncThunk(
  "auth/google",
  async (credential: string, { rejectWithValue }) => {
    try {
      const data = await apiFetch<{ user: User }>("/api/auth/google", {
        method: "POST",
        body: JSON.stringify({ credential }),
      });
      return data.user;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : "Login failed");
    }
  }
);

export const logout = createAsyncThunk("auth/logout", async () => {
  await apiFetch("/api/auth/logout", { method: "POST" });
});

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    /** Replace the current user (e.g. after saving/removing an address). */
    setUser(state, action: PayloadAction<User>) {
      state.user = action.payload;
    },
    /**
     * Record a sign-in failure that happened *before* our thunk ran — i.e. inside
     * Google's own widget (popup blocked, origin not authorised, bad client ID).
     * Without this the button just silently does nothing, because
     * `loginWithGoogle` is never dispatched and no error is ever set.
     */
    setAuthError(state, action: PayloadAction<string>) {
      state.error = action.payload;
      state.status = "anonymous";
    },
    /** Clear a stale error, e.g. when the login dialog is reopened. */
    clearAuthError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMe.fulfilled, (state, action) => {
        state.user = action.payload;
        state.status = "authenticated";
      })
      .addCase(fetchMe.rejected, (state) => {
        state.user = null;
        state.status = "anonymous";
      })
      .addCase(loginWithGoogle.pending, (state) => {
        state.status = "authenticating";
        state.error = null;
      })
      .addCase(loginWithGoogle.fulfilled, (state, action) => {
        state.user = action.payload;
        state.status = "authenticated";
      })
      .addCase(loginWithGoogle.rejected, (state, action) => {
        state.status = "anonymous";
        state.error = (action.payload as string) ?? "Login failed";
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.status = "anonymous";
      });
  },
});

export const { setUser, setAuthError, clearAuthError } = authSlice.actions;
export default authSlice.reducer;
