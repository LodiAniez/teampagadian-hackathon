import { describe, expect, it } from "vitest";
import { validateEnv } from "./env.schema";

// Realistic placeholders — the private key is a literal `0x` + 64 hex chars,
// the addresses are `0x` + 40 hex chars. These are not real keys.
const VALID_PRIVATE_KEY = "0x0000000000000000000000000000000000000000000000000000000000000001";
const VALID_HOT_WALLET_ADDRESS = "0x1111111111111111111111111111111111111111";
const VALID_COINSPH_DEPOSIT_ADDRESS = "0x2222222222222222222222222222222222222222";

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
    MORPH_HOT_WALLET_PRIVATE_KEY: VALID_PRIVATE_KEY,
    MORPH_USDC_CONTRACT_ADDRESS: VALID_HOT_WALLET_ADDRESS,
    MORPH_COINSPH_DEPOSIT_ADDRESS: VALID_COINSPH_DEPOSIT_ADDRESS,
    MORPH_RPC_URL: "https://rpc-hoodi.morph.network",
    MORPH_CHAIN_ID: "2910",
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

  describe("MORPH_HOT_WALLET_PRIVATE_KEY", () => {
    it("accepts a valid 0x-prefixed 64-hex private key", () => {
      const parsed = validateEnv(baseEnv());
      expect(parsed.MORPH_HOT_WALLET_PRIVATE_KEY).toBe(VALID_PRIVATE_KEY);
    });

    it("rejects when missing — it's a hard boot requirement", () => {
      const { MORPH_HOT_WALLET_PRIVATE_KEY: _omit, ...rest } = baseEnv();
      expect(() => validateEnv(rest)).toThrow(/MORPH_HOT_WALLET_PRIVATE_KEY/);
    });

    it("rejects a key without the 0x prefix", () => {
      expect(() =>
        validateEnv({
          ...baseEnv(),
          MORPH_HOT_WALLET_PRIVATE_KEY:
            "0000000000000000000000000000000000000000000000000000000000000001",
        }),
      ).toThrow(/MORPH_HOT_WALLET_PRIVATE_KEY/);
    });

    it("rejects a key of the wrong length", () => {
      expect(() =>
        validateEnv({
          ...baseEnv(),
          MORPH_HOT_WALLET_PRIVATE_KEY: "0xdeadbeef",
        }),
      ).toThrow(/MORPH_HOT_WALLET_PRIVATE_KEY/);
    });

    it("rejects a key with non-hex characters", () => {
      expect(() =>
        validateEnv({
          ...baseEnv(),
          MORPH_HOT_WALLET_PRIVATE_KEY:
            "0xZZZ0000000000000000000000000000000000000000000000000000000000001",
        }),
      ).toThrow(/MORPH_HOT_WALLET_PRIVATE_KEY/);
    });
  });

  describe("MORPH address vars", () => {
    it.each([["MORPH_USDC_CONTRACT_ADDRESS"], ["MORPH_COINSPH_DEPOSIT_ADDRESS"]] as const)(
      "accepts a valid 0x-prefixed 40-hex address for %s",
      (key) => {
        const parsed = validateEnv(baseEnv());
        expect(parsed[key]).toMatch(/^0x[0-9a-fA-F]{40}$/);
      },
    );

    it.each([["MORPH_USDC_CONTRACT_ADDRESS"], ["MORPH_COINSPH_DEPOSIT_ADDRESS"]] as const)(
      "rejects %s when missing",
      (key) => {
        const { [key]: _omit, ...rest } = baseEnv();
        expect(() => validateEnv(rest)).toThrow(new RegExp(key));
      },
    );

    it.each([["MORPH_USDC_CONTRACT_ADDRESS"], ["MORPH_COINSPH_DEPOSIT_ADDRESS"]] as const)(
      "rejects %s without the 0x prefix",
      (key) => {
        expect(() =>
          validateEnv({
            ...baseEnv(),
            [key]: "1111111111111111111111111111111111111111",
          }),
        ).toThrow(new RegExp(key));
      },
    );

    it.each([["MORPH_USDC_CONTRACT_ADDRESS"], ["MORPH_COINSPH_DEPOSIT_ADDRESS"]] as const)(
      "rejects %s of the wrong length",
      (key) => {
        expect(() =>
          validateEnv({
            ...baseEnv(),
            [key]: "0xdeadbeef",
          }),
        ).toThrow(new RegExp(key));
      },
    );
  });

  describe("MORPH_RPC_URL", () => {
    it("accepts a valid URL", () => {
      const parsed = validateEnv(baseEnv());
      expect(parsed.MORPH_RPC_URL).toBe("https://rpc-hoodi.morph.network");
    });

    it("rejects a non-URL value", () => {
      expect(() =>
        validateEnv({
          ...baseEnv(),
          MORPH_RPC_URL: "not-a-url",
        }),
      ).toThrow(/MORPH_RPC_URL/);
    });

    it("rejects when missing", () => {
      const { MORPH_RPC_URL: _omit, ...rest } = baseEnv();
      expect(() => validateEnv(rest)).toThrow(/MORPH_RPC_URL/);
    });
  });

  describe("MORPH_CHAIN_ID", () => {
    it("coerces a string into a positive integer", () => {
      const parsed = validateEnv(baseEnv());
      expect(parsed.MORPH_CHAIN_ID).toBe(2910);
      expect(typeof parsed.MORPH_CHAIN_ID).toBe("number");
    });

    it("rejects zero", () => {
      expect(() =>
        validateEnv({
          ...baseEnv(),
          MORPH_CHAIN_ID: "0",
        }),
      ).toThrow(/MORPH_CHAIN_ID/);
    });

    it("rejects negative numbers", () => {
      expect(() =>
        validateEnv({
          ...baseEnv(),
          MORPH_CHAIN_ID: "-1",
        }),
      ).toThrow(/MORPH_CHAIN_ID/);
    });

    it("rejects non-numeric strings", () => {
      expect(() =>
        validateEnv({
          ...baseEnv(),
          MORPH_CHAIN_ID: "not-a-number",
        }),
      ).toThrow(/MORPH_CHAIN_ID/);
    });

    it("rejects when missing", () => {
      const { MORPH_CHAIN_ID: _omit, ...rest } = baseEnv();
      expect(() => validateEnv(rest)).toThrow(/MORPH_CHAIN_ID/);
    });
  });
});
