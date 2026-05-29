import { z } from "zod";

const PublicEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url(),
});

// Next.js statically replaces process.env.NEXT_PUBLIC_* at build time, so each
// var must be referenced by its literal name.
export const env = PublicEnvSchema.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
});

export type PublicEnv = z.infer<typeof PublicEnvSchema>;
