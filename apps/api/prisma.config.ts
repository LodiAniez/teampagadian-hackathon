import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "prisma/config";

const here = path.dirname(fileURLToPath(import.meta.url));
const monorepoEnv = path.resolve(here, "../../.env");
const localEnv = path.resolve(here, ".env");

// Prisma 7+ no longer auto-loads .env when prisma.config.ts is present, so
// we load it ourselves. Prefer the workspace root .env; fall back to a
// per-app .env if someone has overridden values locally.
for (const envPath of [monorepoEnv, localEnv]) {
  if (existsSync(envPath)) {
    process.loadEnvFile(envPath);
  }
}

// Migrate / introspect CLI operations need a direct, unpooled connection.
// Runtime PrismaClient uses the pooled DATABASE_URL via the adapter in
// PrismaService — see apps/api/src/common/prisma/prisma.service.ts.
const migrateUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

export default defineConfig({
  schema: "./prisma/schema.prisma",
  datasource: {
    url: migrateUrl ?? "",
  },
  migrations: {
    path: "./prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
