import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const VALID_ENV = {
  EXPO_PUBLIC_API_URL: "https://api.example.test",
  EXPO_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  EXPO_PUBLIC_SUPABASE_ANON_KEY: "anon-key-12345",
  EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_12345",
};

describe("lib/api-client", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.EXPO_PUBLIC_API_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    delete process.env.EXPO_PUBLIC_DEV_BEARER;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("buildAuthorizationHeader returns a Bearer token when EXPO_PUBLIC_DEV_BEARER is set", async () => {
    Object.assign(process.env, VALID_ENV, { EXPO_PUBLIC_DEV_BEARER: "abc.def.ghi" });
    const { buildAuthorizationHeader } = await import("./api-client");
    expect(buildAuthorizationHeader()).toBe("Bearer abc.def.ghi");
  });

  it("buildAuthorizationHeader returns an empty string when EXPO_PUBLIC_DEV_BEARER is unset", async () => {
    Object.assign(process.env, VALID_ENV);
    const { buildAuthorizationHeader } = await import("./api-client");
    expect(buildAuthorizationHeader()).toBe("");
  });
});
