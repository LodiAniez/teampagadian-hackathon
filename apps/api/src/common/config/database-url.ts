import type { EnvConfig } from "./env.schema";

export type DatabaseUrlEnv = Pick<
  EnvConfig,
  "NODE_ENV" | "DATABASE_URL" | "DIRECT_URL" | "LOCAL_DATABASE_URL" | "LOCAL_DIRECT_URL"
>;

export interface ResolvedDatabaseUrl {
  url: string;
  directUrl?: string;
}

export function resolveDatabaseUrl(env: DatabaseUrlEnv): ResolvedDatabaseUrl {
  if (env.NODE_ENV === "development" && env.LOCAL_DATABASE_URL) {
    return {
      url: env.LOCAL_DATABASE_URL,
      directUrl: env.LOCAL_DIRECT_URL ?? env.LOCAL_DATABASE_URL,
    };
  }
  return { url: env.DATABASE_URL, directUrl: env.DIRECT_URL };
}
