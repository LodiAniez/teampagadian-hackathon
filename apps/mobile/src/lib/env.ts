import { z } from "zod";

const schema = z.object({
  EXPO_PUBLIC_API_URL: z.string().url("EXPO_PUBLIC_API_URL must be a valid URL"),
  EXPO_PUBLIC_SUPABASE_URL: z.string().url("EXPO_PUBLIC_SUPABASE_URL must be a valid URL"),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "EXPO_PUBLIC_SUPABASE_ANON_KEY is required"),
  EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY: z
    .string()
    .min(1, "EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY is required"),
  // Dev-only Bearer token for hitting the authed API before TEA-17/18 (login) lands.
  // Paste a JWT from the Supabase dashboard. Remove once `lib/auth.ts` reads from secure-store.
  EXPO_PUBLIC_DEV_BEARER: z.string().optional(),
});

const result = schema.safeParse({
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  EXPO_PUBLIC_DEV_BEARER: process.env.EXPO_PUBLIC_DEV_BEARER,
});

if (!result.success) {
  const missing = result.error.errors
    .map((e) => `  • ${e.path.join(".")}: ${e.message}`)
    .join("\n");
  throw new Error(
    `[env] Missing or invalid environment variables:\n${missing}\n\nAdd these to your .env file at the repo root.`,
  );
}

export const env = result.data;
