import { z } from "zod";

// EVM hex shapes. Reused for the two Morph address vars (USDC contract +
// Coins.ph deposit destination); private-key regex is single-use but kept
// alongside for legibility.
const HEX_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const HEX_PRIVATE_KEY_RE = /^0x[0-9a-fA-F]{64}$/;

export const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),

  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),

  // Optional local-Postgres overrides. When NODE_ENV=development and
  // LOCAL_DATABASE_URL is set, PrismaService uses these instead of the
  // production DATABASE_URL / DIRECT_URL.
  LOCAL_DATABASE_URL: z.string().url().optional(),
  LOCAL_DIRECT_URL: z.string().url().optional(),

  FRESH_AUTH_MAX_AGE_SECONDS: z.coerce.number().int().positive().default(300),

  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
  // Optional at boot: Railway sets this only after the Stripe webhook endpoint
  // is configured, which happens after the API has a public URL.
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),

  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().min(1).default("gemini-2.5-flash"),

  RESEND_API_KEY: z.string().startsWith("re_"),
  RESEND_FROM_EMAIL: z.string().email().optional(),

  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  // Comma-separated allowlist of browser origins for CORS. Parsed into a
  // validated URL array; each entry must be a full origin (no trailing path).
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:3000")
    .transform((s) =>
      s
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().url()).min(1)),

  // Morph Hoodi settlement-leg vars. Provisioned by TEA-75 in Railway;
  // consumed by SettlementService for viem on-chain transfers (TEA-76).
  // All required at boot — there is no safe default for any of them.
  MORPH_HOT_WALLET_PRIVATE_KEY: z.string().regex(HEX_PRIVATE_KEY_RE),
  MORPH_USDC_CONTRACT_ADDRESS: z.string().regex(HEX_ADDRESS_RE),
  MORPH_COINSPH_DEPOSIT_ADDRESS: z.string().regex(HEX_ADDRESS_RE),
  MORPH_RPC_URL: z.string().url(),
  MORPH_CHAIN_ID: z.coerce.number().int().positive(),
});

export type EnvConfig = z.infer<typeof EnvSchema>;

export function validateEnv(raw: Record<string, unknown>): EnvConfig {
  const parsed = EnvSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}
