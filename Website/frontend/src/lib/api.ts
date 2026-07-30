import type { ApiResponse } from "@shared/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Thin fetch wrapper: sends/receives JSON, includes cookies, unwraps the envelope. */
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  // Spread `options` FIRST so the defaults below always win: a caller passing its
  // own `headers` must not silently drop Content-Type, and nothing may drop
  // `credentials: "include"` (which would send the request without the auth
  // cookie and fail every logged-in call with a 401).
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  let body: ApiResponse<T> | null = null;
  try {
    body = (await res.json()) as ApiResponse<T>;
  } catch {
    // non-JSON response
  }

  if (!res.ok || !body?.success) {
    throw new ApiError(res.status, body?.message ?? `Request failed (${res.status})`);
  }

  return body.data as T;
}

export { API_URL };
