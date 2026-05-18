import { getToken, clearToken } from "./auth-cookie";

/**
 * Base API URL for all requests.
 * In production, this should be replaced with:
 * process.env.NEXT_PUBLIC_API_URL
 */
const API_BASE_URL = "http://localhost:3000" as const;

/**
 * Extended fetch options
 * - skipAuth: allows public endpoints (login, register, etc.)
 */
type ApiOptions = RequestInit & {
  skipAuth?: boolean;
};

/**
 * Core request handler (generic + reusable)
 *
 * Features:
 * - Automatically attaches JWT from cookies
 * - Handles JSON parsing safely
 * - Handles 401 globally (auto logout)
 * - Supports typed responses via generics <T>
 */
async function request<T>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<T> {
  // Retrieve JWT token from cookies (if exists)
  const token = getToken();

  /**
   * Default headers for every request
   * Content-Type is JSON by default for API consistency
   */
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  /**
   * Attach Authorization header automatically
   * unless explicitly skipped (public routes)
   */
  if (!options.skipAuth && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  /**
   * Perform HTTP request using Fetch API
   */
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  /**
   * Global Unauthorized Handler (401)
   * - Clear stored token
   * - Redirect user to login page
   * - Prevent access to protected resources
   */
  if (res.status === 401) {
    clearToken();

    // Ensure browser environment before redirect (avoid SSR crash)
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }

    throw new Error("Unauthorized");
  }

  /**
   * Safely detect response type
   * (prevents JSON parsing errors on empty responses)
   */
  const contentType = res.headers.get("content-type");
  const isJson = contentType?.includes("application/json");

  /**
   * Parse response body safely
   * - JSON if available
   * - null for empty responses (204, etc.)
   */
  const data = isJson ? await res.json() : null;

  /**
   * Handle non-2xx responses
   * - Uses backend message if available
   * - Falls back to generic error
   */
  if (!res.ok) {
    throw new Error(data?.message || "API request failed");
  }

  /**
   * Return typed response
   * (ensures full TypeScript safety for consumers)
   */
  return data as T;
}

/**
 * API helper methods
 * Provides clean abstraction over HTTP methods
 */
export const api = {
  /**
   * GET request
   */
  get: <T>(url: string, options?: ApiOptions) =>
    request<T>(url, { ...options, method: "GET" }),

  /**
   * POST request
   * Sends JSON body
   */
  post: <T>(url: string, body?: any, options?: ApiOptions) =>
    request<T>(url, {
      ...options,
      method: "POST",
      body: JSON.stringify(body),
    }),

  /**
   * PUT request
   * Used for full updates
   */
  put: <T>(url: string, body?: any, options?: ApiOptions) =>
    request<T>(url, {
      ...options,
      method: "PUT",
      body: JSON.stringify(body),
    }),

  /**
   * DELETE request
   */
  delete: <T>(url: string, options?: ApiOptions) =>
    request<T>(url, {
      ...options,
      method: "DELETE",
    }),
};