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
    JWT_SECRET: "a-very-long-secret-key-that-is-at-least-32-chars",
    ANTHROPIC_API_KEY: "sk-ant-test",
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

  it("defaults OTP_TEST to false when unset", () => {
    const parsed = validateEnv(baseEnv());

    expect(parsed.OTP_TEST).toBe(false);
  });

  it('coerces OTP_TEST="true" to boolean true', () => {
    const parsed = validateEnv({ ...baseEnv(), OTP_TEST: "true" });

    expect(parsed.OTP_TEST).toBe(true);
  });

  it('coerces OTP_TEST="false" to boolean false', () => {
    const parsed = validateEnv({ ...baseEnv(), OTP_TEST: "false" });

    expect(parsed.OTP_TEST).toBe(false);
  });
});
