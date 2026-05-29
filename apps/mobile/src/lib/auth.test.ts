import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { sessionRef, getSessionErrorRef } = vi.hoisted(() => ({
  sessionRef: { current: null as { access_token: string; refresh_token: string } | null },
  getSessionErrorRef: { current: null as Error | null },
}));

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(async () => null),
  setItemAsync: vi.fn(async () => undefined),
  deleteItemAsync: vi.fn(async () => undefined),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn(async () => {
        if (getSessionErrorRef.current) throw getSessionErrorRef.current;
        return { data: { session: sessionRef.current } };
      }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  })),
}));

beforeAll(() => {
  process.env.EXPO_PUBLIC_API_URL = "https://api.example.test";
  process.env.EXPO_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "anon-key-12345";
  process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test_12345";
});

beforeEach(() => {
  sessionRef.current = null;
  getSessionErrorRef.current = null;
});

describe("lib/auth — getAccessToken", () => {
  it("returns null when supabase has no active session", async () => {
    const { getAccessToken } = await import("./auth");
    await expect(getAccessToken()).resolves.toBeNull();
  });

  it("returns the access_token from the current supabase session", async () => {
    sessionRef.current = { access_token: "access-abc", refresh_token: "refresh-xyz" };
    const { getAccessToken } = await import("./auth");
    await expect(getAccessToken()).resolves.toBe("access-abc");
  });
});

describe("lib/auth — authHeader", () => {
  it("emits Bearer <token> when a session exists", async () => {
    sessionRef.current = { access_token: "access-abc", refresh_token: "refresh-xyz" };
    const { authHeader } = await import("./auth");
    await expect(authHeader()).resolves.toEqual({ authorization: "Bearer access-abc" });
  });

  it("emits an empty authorization string when no session exists", async () => {
    const { authHeader } = await import("./auth");
    await expect(authHeader()).resolves.toEqual({ authorization: "" });
  });
});

describe("lib/auth — resolveInitialSession", () => {
  it("returns the active session when getSession resolves", async () => {
    sessionRef.current = { access_token: "access-abc", refresh_token: "refresh-xyz" };
    const { resolveInitialSession } = await import("./auth");
    await expect(resolveInitialSession()).resolves.toEqual({ session: sessionRef.current });
  });

  it("returns { session: null } and logs the failure when getSession rejects", async () => {
    // Without the catch in resolveInitialSession the rejection would escape
    // useSession's then() chain, isLoading would stay true forever, and the
    // root layout would sit on the splash screen with no recovery path —
    // exactly the TEA-90 hang the user hit on a freshly-wiped emulator.
    const failure = new Error("network unreachable");
    getSessionErrorRef.current = failure;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { resolveInitialSession } = await import("./auth");
    await expect(resolveInitialSession()).resolves.toEqual({ session: null });
    expect(warnSpy).toHaveBeenCalledWith("[auth] getSession failed:", failure);

    warnSpy.mockRestore();
  });
});
