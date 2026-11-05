import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import * as SecureStore from "expo-secure-store";

const PUSH_TOKEN_KEY = "expo_push_token";

export function usePushToken() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        // Check if we already have a token stored
        const stored = await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
        if (stored) {
          setToken(stored);
          setLoading(false);
          return;
        }

        // Get Expo push token
        const { getExpoPushTokenAsync, getPermissionsAsync, requestPermissionsAsync } = await import("expo-notifications");

        let { status: existingStatus } = await getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== "granted") {
          const { status } = await requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== "granted") {
          console.log("Push notification permission not granted");
          setLoading(false);
          return;
        }

        const expoToken = (await getExpoPushTokenAsync()).data;

        // Register with backend
        await apiFetch("/api/push/token", {
          method: "POST",
          body: JSON.stringify({ token: expoToken }),
        });

        // Store token securely
        await SecureStore.setItemAsync(PUSH_TOKEN_KEY, expoToken);
        setToken(expoToken);
      } catch (err) {
        console.error("Failed to register push token:", err);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  return { token, loading };
}

export async function registerPushTokenManually(): Promise<string | null> {
  try {
    const { getExpoPushTokenAsync, getPermissionsAsync, requestPermissionsAsync } = await import("expo-notifications");

    let { status: existingStatus } = await getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      return null;
    }

    const expoToken = (await getExpoPushTokenAsync()).data;

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