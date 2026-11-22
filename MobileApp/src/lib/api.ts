import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import type { ApiResponse } from '@shared/types';

// API base URL. Reads app.json -> expo.extra.apiUrl. When testing on a physical
// device, replace localhost with your computer's LAN IP (e.g. http://192.168.1.5:5000)
// because "localhost" on the phone points at the phone itself.
export const API_URL =
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ?? 'http://localhost:5000';

export const STOREFRONT_URL = (Constants.expoConfig?.extra as { storefrontUrl?: string } | undefined)?.storefrontUrl ?? '';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const TOKEN_KEY = 'rt_token';

// The token is cached in memory for the current app session and persisted in
// SecureStore so a cold start stays signed in.
let cachedToken: string | null = null;

/** Load the persisted token into memory (call once at startup). */
export async function primeAuthToken(): Promise<void> {
  try {
    cachedToken = await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    cachedToken = null;
  }
}

/** Store or clear the session token. */
export async function setAuthToken(token: string | null): Promise<void> {
  cachedToken = token;
  try {
    if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    /* storage is best-effort; memory still works for this session */
  }
}

async function authToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  cachedToken = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
  return cachedToken;
}

// Thin fetch wrapper: sends/receives JSON, attaches the bearer token and
// unwraps the { success, data } envelope.
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await authToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string> | undefined) ?? {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  let body: ApiResponse<T> | null = null;
  try {
    body = (await res.json()) as ApiResponse<T>;
  } catch {
    /* non-JSON response */
  }

  if (!res.ok || !body?.success) {
    throw new ApiError(res.status, body?.message ?? `Request failed (${res.status})`);
  }
  return body.data as T;
}

// Format a number as Indian Rupees (shared with the website's convention).
export function formatINR(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}
