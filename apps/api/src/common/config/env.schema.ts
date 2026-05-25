import { z } from "zod";

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
