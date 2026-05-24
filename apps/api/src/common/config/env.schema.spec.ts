import { describe, expect, it } from "vitest";
import { validateEnv } from "./env.schema";

function baseEnv(): Record<string, string> {
  return {
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://user:pass@db.example.com:5432/postgres",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_ANON_KEY: "anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    STRIPE_SECRET_KEY: "sk_test_123",
    GEMINI_API_KEY: "test-gemini-key",
    RESEND_API_KEY: "re_test",
    NEXT_PUBLIC_APP_URL: "https://app.example.com",
  };
}

describe("validateEnv", () => {
  it("accepts an env without STRIPE_WEBHOOK_SECRET", () => {
    const parsed = validateEnv(baseEnv());

    expect(parsed.STRIPE_WEBHOOK_SECRET).toBeUndefined();
  });

  it("accepts a valid STRIPE_WEBHOOK_SECRET", () => {
    const parsed = validateEnv({
      ...baseEnv(),
      STRIPE_WEBHOOK_SECRET: "whsec_abc123",
    });

    expect(parsed.STRIPE_WEBHOOK_SECRET).toBe("whsec_abc123");
  });

  it("rejects a STRIPE_WEBHOOK_SECRET with the wrong prefix when provided", () => {
    expect(() =>
      validateEnv({
        ...baseEnv(),
        STRIPE_WEBHOOK_SECRET: "not-a-real-secret",
      }),
    ).toThrow(/STRIPE_WEBHOOK_SECRET/);
  });

  describe("CORS_ORIGINS", () => {
    it("defaults to a single localhost origin when unset", () => {
      const parsed = validateEnv(baseEnv());

      expect(parsed.CORS_ORIGINS).toEqual(["http://localhost:3000"]);
    });

    it("parses a single origin", () => {
      const parsed = validateEnv({
        ...baseEnv(),
        CORS_ORIGINS: "https://app.example.com",
      });

      expect(parsed.CORS_ORIGINS).toEqual(["https://app.example.com"]);
    });

    it("parses comma-separated origins and trims whitespace", () => {
      const parsed = validateEnv({
        ...baseEnv(),
        CORS_ORIGINS:
          "https://app.example.com, https://staging.example.com ,https://pr-42.example.com",
      });

      expect(parsed.CORS_ORIGINS).toEqual([
        "https://app.example.com",
        "https://staging.example.com",
        "https://pr-42.example.com",
      ]);
    });

    it("rejects an entry that is not a URL", () => {
      expect(() =>
        validateEnv({
          ...baseEnv(),
          CORS_ORIGINS: "https://app.example.com,not-a-url",
        }),
      ).toThrow(/CORS_ORIGINS/);
    });

    it("rejects an empty value", () => {
      expect(() =>
        validateEnv({
          ...baseEnv(),
          CORS_ORIGINS: "",
        }),
      ).toThrow(/CORS_ORIGINS/);
    });
  });
});
