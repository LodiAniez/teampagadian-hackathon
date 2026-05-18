"use client";
import Cookies from "js-cookie";

const ACCESS_TOKEN_COOKIE = "raket_access_token";
const SEVEN_DAYS_SECONDS = 60 * 60 * 24 * 7;

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  const match = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : null;
}

export function setAccessToken(token: string): void {
  if (typeof document === "undefined") return;
  // SameSite=Lax + Path=/ so the cookie is sent on top-level navigations.
  // Secure is only set when the page itself is served over HTTPS — local dev runs on http://localhost.
  const secure = typeof window !== "undefined" && window.location.protocol === "https:";
  const attrs = [
    `${ACCESS_TOKEN_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    `Max-Age=${SEVEN_DAYS_SECONDS}`,
    "SameSite=Lax",
    ...(secure ? ["Secure"] : []),
  ];
  document.cookie = attrs.join("; ");
}

export function clearAccessToken(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${ACCESS_TOKEN_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export async function getAccessToken(): Promise<string | null> {
  return readCookie(ACCESS_TOKEN_COOKIE);
}

export async function authHeader(): Promise<{ authorization: string }> {
  const token = await getAccessToken();
  return { authorization: token ? `Bearer ${token}` : "" };
}


const TOKEN_KEY = "access_token" as const;

export const setToken = (token: string) => {
  Cookies.set(TOKEN_KEY, token, {
    expires: 7,
    secure: true,
    sameSite: "strict",
  });
};

export const getToken = () => Cookies.get(TOKEN_KEY);

export const clearToken = () => Cookies.remove(TOKEN_KEY);