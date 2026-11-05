import assert from "node:assert/strict";
import { test } from "node:test";
import { makeStore } from "../src/store";
import { continueAsGuest, fetchMe, loginWithGoogle, logout } from "../src/store/authSlice";
import { loginDestination, saveGuestSession, signedInDestination } from "../src/lib/auth-session";

test("session and account switching regressions", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  } });
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  const user = { id: "customer", googleId: "google-customer", email: "customer@gmail.com", name: "Customer", role: "USER", addresses: [] };
  const response = (data: unknown, status = 200) => new Response(JSON.stringify({ success: status === 200, data, message: "Request failed" }), { status });
  const anonymousStore = async () => {
    storage.clear();
    globalThis.fetch = async () => response(null, 401);
    const store = makeStore();
    await store.dispatch(fetchMe());
    return store;
  };

  try {
    await t.test("a new visitor is anonymous, never automatically a guest", async () => {
      const store = await anonymousStore();
      assert.equal(store.getState().auth.isGuest, false);
      assert.equal(store.getState().auth.user, null);
    });

    await t.test("explicit guest choice survives reload and guest logout clears it", async () => {
      const store = await anonymousStore();
      saveGuestSession(true);
      store.dispatch(continueAsGuest());
      assert.equal(store.getState().auth.isGuest, true);
      globalThis.fetch = async () => { throw new Error("Guest should not restore a Google session"); };
      const reloaded = makeStore();
      await reloaded.dispatch(fetchMe());
      assert.equal(reloaded.getState().auth.isGuest, true);
      await reloaded.dispatch(logout()).unwrap();
      assert.equal(reloaded.getState().auth.isGuest, false);
      assert.equal(storage.size, 0);
    });

    await t.test("duplicate bootstraps do not race or overwrite Google login", async () => {
      storage.clear();
      let resolveSession!: (value: Response) => void;
      let requests = 0;
      globalThis.fetch = async (input) => {
        if (String(input).endsWith("/me")) {
          requests++;
          return new Promise<Response>((resolve) => { resolveSession = resolve; });
        }
        return response({ user });
      };
      const store = makeStore();
      const pendingSession = store.dispatch(fetchMe());
      await store.dispatch(fetchMe());
      assert.equal(requests, 1);
      await store.dispatch(loginWithGoogle("credential")).unwrap();
      resolveSession(response(null, 401));
      await pendingSession;
      assert.equal(store.getState().auth.user?.id, user.id);
      assert.equal(store.getState().auth.status, "authenticated");
    });

    await t.test("logout waits for the backend and prevents stale restoration", async () => {
      const store = await anonymousStore();
      globalThis.fetch = async () => response({ user });
      await store.dispatch(loginWithGoogle("credential"));
      let finishLogout!: (value: Response) => void;
      globalThis.fetch = async () => new Promise<Response>((resolve) => { finishLogout = resolve; });
      const pending = store.dispatch(logout());
      assert.equal(store.getState().auth.status, "signing-out");
      assert.equal(store.getState().auth.user?.id, user.id);
      finishLogout(response(null));
      await pending.unwrap();
      assert.equal(store.getState().auth.user, null);
      assert.equal(store.getState().auth.isGuest, false);
      assert.equal(store.getState().auth.status, "anonymous");
      const restored = await store.dispatch(fetchMe());
      assert.equal(restored.meta.requestStatus, "rejected");
      assert.equal(store.getState().auth.user, null);
    });

    await t.test("failed logout keeps the account and exposes a retryable error", async () => {
      const store = await anonymousStore();
      globalThis.fetch = async () => response({ user });
      await store.dispatch(loginWithGoogle("credential"));
      globalThis.fetch = async () => { throw new Error("Network offline"); };
      await store.dispatch(logout());
      assert.equal(store.getState().auth.user?.id, user.id);
      assert.equal(store.getState().auth.status, "authenticated");
      assert.equal(store.getState().auth.error, "Network offline");
    });

    await t.test("Google login replaces guest mode and preserves the backend role", async () => {
      const store = await anonymousStore();
      saveGuestSession(true);
      store.dispatch(continueAsGuest());
      globalThis.fetch = async () => response({ user: { ...user, role: "ADMIN" } });
      await store.dispatch(loginWithGoogle("admin-credential")).unwrap();
      assert.equal(store.getState().auth.user?.role, "ADMIN");
      assert.equal(store.getState().auth.isGuest, false);
      assert.equal(storage.size, 0);
    });

    await t.test("post-login destinations stay on this site and keep filters", () => {
      for (const path of [null, "//evil.com", "https://evil.com", "/\\evil.com", "/login?redirect=/login", "/%2e%2e/login"]) {
        assert.equal(loginDestination(path), "/products");
      }
      assert.equal(loginDestination("/products?category=tiles"), "/products?category=tiles");
    });

    await t.test("switching from admin to customer never reopens admin routes", () => {
      assert.equal(signedInDestination("USER", "/admin"), "/products");
      assert.equal(signedInDestination("USER", "/admin/products?sort=newest"), "/products");
      assert.equal(signedInDestination("USER", "/checkout"), "/checkout");
      assert.equal(signedInDestination("ADMIN", "/products"), "/admin");
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (originalStorage) Object.defineProperty(globalThis, "sessionStorage", originalStorage);
    else Reflect.deleteProperty(globalThis, "sessionStorage");
  }
});
