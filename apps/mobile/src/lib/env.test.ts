import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const VALID_ENV = {
  EXPO_PUBLIC_API_URL: "https://api.example.test",
  EXPO_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  EXPO_PUBLIC_SUPABASE_ANON_KEY: "anon-key-12345",
  EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_12345",
};

describe("lib/env", () => {
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

  it("parses a valid env and exposes typed values", async () => {
    Object.assign(process.env, VALID_ENV);
    const { env } = await import("./env");
    expect(env.EXPO_PUBLIC_API_URL).toBe(VALID_ENV.EXPO_PUBLIC_API_URL);
    expect(env.EXPO_PUBLIC_SUPABASE_URL).toBe(VALID_ENV.EXPO_PUBLIC_SUPABASE_URL);
    expect(env.EXPO_PUBLIC_SUPABASE_ANON_KEY).toBe(VALID_ENV.EXPO_PUBLIC_SUPABASE_ANON_KEY);
    expect(env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY).toBe(
      VALID_ENV.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    );
  });

  it("throws at boot when an URL is malformed", async () => {
    Object.assign(process.env, VALID_ENV, { EXPO_PUBLIC_API_URL: "not-a-url" });
    await expect(import("./env")).rejects.toThrow(/EXPO_PUBLIC_API_URL/);
  });

  it("throws at boot when the anon key is empty", async () => {
    Object.assign(process.env, VALID_ENV, { EXPO_PUBLIC_SUPABASE_ANON_KEY: "" });
    await expect(import("./env")).rejects.toThrow(/EXPO_PUBLIC_SUPABASE_ANON_KEY/);
  });

  it("throws at boot when the Stripe publishable key is missing", async () => {
    Object.assign(process.env, VALID_ENV);
    delete process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    await expect(import("./env")).rejects.toThrow(/EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY/);
  });

  it("treats EXPO_PUBLIC_DEV_BEARER as optional and exposes it when set", async () => {
    Object.assign(process.env, VALID_ENV, { EXPO_PUBLIC_DEV_BEARER: "eyJhbGciOi.devjwt.sig" });
    const { env } = await import("./env");
    expect(env.EXPO_PUBLIC_DEV_BEARER).toBe("eyJhbGciOi.devjwt.sig");
  });

  it("boots without EXPO_PUBLIC_DEV_BEARER and leaves it undefined", async () => {
    Object.assign(process.env, VALID_ENV);
    const { env } = await import("./env");
    expect(env.EXPO_PUBLIC_DEV_BEARER).toBeUndefined();
  });

  it("aggregates multiple missing variables into a single error message", async () => {
    Object.assign(process.env, VALID_ENV);
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    await expect(import("./env")).rejects.toThrow(
      /EXPO_PUBLIC_SUPABASE_URL[\s\S]+EXPO_PUBLIC_SUPABASE_ANON_KEY/,
    );
  });
});
