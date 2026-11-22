import { useEffect, useState } from "react";
import { Alert, Platform } from "react-native";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { apiFetch, primeAuthToken, setAuthToken } from "@/lib/api";
import * as SecureStore from "expo-secure-store";
import type { User } from "@shared/types";

// This completes the auth session - required for expo-auth-session to work
WebBrowser.maybeCompleteAuthSession();

interface UseGoogleAuthResult {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const USER_KEY = "rt_user";

// Google OAuth configuration. Native builds must use the platform client id;
// the web client id is kept as the Expo Go / fallback value.
const GOOGLE_CLIENT_ID =
  Platform.select({
    ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    default: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
  }) ||
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ||
  "your-google-client-id.apps.googleusercontent.com";

// Discovery document for Google
const discovery = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  revocationEndpoint: "https://oauth2.googleapis.com/revoke",
};

const scopes = ["openid", "email", "profile"];

// Set EXPO_PUBLIC_GOOGLE_REDIRECT_URI to the exact URI registered in Google
// Cloud (useful for Expo Go / development builds). On iOS, Google requires the
// reversed-client-id scheme below.
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const defaultRedirectUri =
  Platform.OS === "ios" && iosClientId
    ? `com.googleusercontent.apps.${iosClientId.replace(/\.apps\.googleusercontent\.com$/, "")}:/oauth2redirect`
    : AuthSession.makeRedirectUri({ scheme: "ramachandra", path: "oauth2redirect" });
const redirectUri = process.env.EXPO_PUBLIC_GOOGLE_REDIRECT_URI || defaultRedirectUri;

export function useGoogleAuth(): UseGoogleAuthResult {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user + token from secure storage on mount
  useEffect(() => {
    const loadUser = async () => {
      try {
        await primeAuthToken();
        const storedUser = await SecureStore.getItemAsync(USER_KEY);
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
      } catch {
        // Ignore storage errors
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  // Use the implicit flow to get an ID token directly
  // This is the flow that gives us the ID token the backend expects
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GOOGLE_CLIENT_ID,
      scopes,
      redirectUri,
      usePKCE: false, // Disable PKCE for implicit flow to get ID token
      responseType: AuthSession.ResponseType.IdToken,
      extraParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
    discovery
  );

  // Handle the auth response
  useEffect(() => {
    if (response?.type === "success") {
      const { id_token } = response.params;
      if (id_token) {
        exchangeIdTokenForSession(id_token);
      }
    } else if (response?.type === "error") {
      console.error("[GoogleAuth] Auth error:", response.error);
      Alert.alert("Sign in failed", response.error?.message ?? "Google sign-in was cancelled or failed.");
    }
  }, [response]);

  const exchangeIdTokenForSession = async (idToken: string) => {
    try {
      // Send the ID token to the backend (the backend calls this field 'credential')
      const data = await apiFetch<{ user: User; token: string }>("/api/auth/google", {
        method: "POST",
        body: JSON.stringify({ credential: idToken }),
      });

      if (data.user && data.token) {
        setUser(data.user);
        await setAuthToken(data.token);
        await SecureStore.setItemAsync(USER_KEY, JSON.stringify(data.user));
      }
    } catch (e) {
      console.error("[GoogleAuth] ID token exchange failed:", e);
      Alert.alert("Sign in failed", e instanceof Error ? e.message : "Could not verify your Google account.");
      throw e;
    }
  };

  const signIn = async () => {
    if (!request) {
      Alert.alert("Please wait", "Google sign-in is still loading. Try again in a moment.");
      return;
    }
    await promptAsync();
    // The response is handled by the useEffect above
  };

  const signOut = async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Ignore logout errors
    }
    await SecureStore.deleteItemAsync(USER_KEY);
    await setAuthToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const data = await apiFetch<{ user: User }>("/api/auth/me");
      setUser(data.user);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(data.user));
    } catch (e) {
      console.warn("[GoogleAuth] Refresh failed:", e);
      await SecureStore.deleteItemAsync(USER_KEY);
      await setAuthToken(null);
      setUser(null);
    }
  };

  return { user, loading, signIn, signOut, refreshUser };
}