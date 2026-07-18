import Constants from "expo-constants";
import type { ApiResponse } from "@shared/types";

/**
 * API base URL. Reads app.json -> expo.extra.apiUrl. When testing on a physical
 * device, replace localhost with your computer's LAN IP (e.g. http://192.168.1.5:5000)
 * because "localhost" on the phone points at the phone itself.
 */
export const API_URL =
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ?? "http://localhost:5000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Thin fetch wrapper: sends/receives JSON and unwraps the { success, data } envelope. */
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
    ...options,
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

/** Format a number as Indian Rupees (shared with the website's convention). */
export function formatINR(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}
