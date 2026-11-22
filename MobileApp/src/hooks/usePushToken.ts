import { useEffect, useRef, useState } from "react";
import Constants from "expo-constants";
import { apiFetch } from "@/lib/api";
import * as SecureStore from "expo-secure-store";

const PUSH_TOKEN_KEY = "expo_push_token";

const projectId =
  (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? undefined;

/**
 * Requests an Expo push token once, then registers it with the backend
 * whenever the signed-in user changes. Registration is skipped while signed
 * out because /api/push/token requires a bearer token.
 */
export function usePushToken(userId?: string | null) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const registeredFor = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    const init = async () => {
      try {
        const stored = await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
        if (stored) {
          if (active) setToken(stored);
          return;
        }

        const { getExpoPushTokenAsync, getPermissionsAsync, requestPermissionsAsync } = await import("expo-notifications");

        let { status } = await getPermissionsAsync();
        if (status !== "granted") {
          ({ status } = await requestPermissionsAsync());
        }
        if (status !== "granted") return;

        const expoToken = (await getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
        await SecureStore.setItemAsync(PUSH_TOKEN_KEY, expoToken);
        if (active) setToken(expoToken);
      } catch (err) {
        console.warn("[push] Could not obtain an Expo push token:", err);
      } finally {
        if (active) setLoading(false);
      }
    };
    void init();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!token || !userId || registeredFor.current === userId) return;
    registeredFor.current = userId;
    apiFetch("/api/push/token", { method: "POST", body: JSON.stringify({ token }) }).catch((err) => {
      // Allow a later retry (e.g. after a transient network failure).
      registeredFor.current = null;
      console.warn("[push] Token registration failed:", err);
    });
  }, [token, userId]);

  return { token, loading };
}

export async function registerPushTokenManually(): Promise<string | null> {
  try {
    const { getExpoPushTokenAsync, getPermissionsAsync, requestPermissionsAsync } = await import("expo-notifications");

    let { status } = await getPermissionsAsync();
    if (status !== "granted") {
      ({ status } = await requestPermissionsAsync());
    }
    if (status !== "granted") return null;

    const expoToken = (await getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;

    await apiFetch("/api/push/token", {
      method: "POST",
      body: JSON.stringify({ token: expoToken }),
    });

    await SecureStore.setItemAsync(PUSH_TOKEN_KEY, expoToken);
    return expoToken;
  } catch (err) {
    console.error("Failed to register push token:", err);
    return null;
  }
}

export async function getStoredPushToken(): Promise<string | null> {
  return SecureStore.getItemAsync(PUSH_TOKEN_KEY);
}

export async function clearPushToken(): Promise<void> {
  await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
}
