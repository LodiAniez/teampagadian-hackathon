import { describe, expect, it } from "vitest";
import { resolveDatabaseUrl, type DatabaseUrlEnv } from "./database-url";

function env(overrides: Partial<DatabaseUrlEnv>): DatabaseUrlEnv {
  return {
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://prod:prod@db.example.com:5432/postgres",
    DIRECT_URL: "postgresql://prod:prod@db.example.com:5432/postgres",
    ...overrides,
  };
}

describe("resolveDatabaseUrl", () => {
  it("uses LOCAL_DATABASE_URL in development when set", () => {
    const result = resolveDatabaseUrl(
      env({
        NODE_ENV: "development",
        LOCAL_DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/raket",
      }),
    );

    expect(result.url).toBe("postgresql://postgres:postgres@localhost:5432/raket");
    expect(result.directUrl).toBe("postgresql://postgres:postgres@localhost:5432/raket");
  });

  it("uses LOCAL_DIRECT_URL when provided alongside LOCAL_DATABASE_URL", () => {
    const result = resolveDatabaseUrl(
      env({
        NODE_ENV: "development",
        LOCAL_DATABASE_URL: "postgresql://pooler.local:6543/raket",
        LOCAL_DIRECT_URL: "postgresql://direct.local:5432/raket",
      }),
    );

    expect(result.url).toBe("postgresql://pooler.local:6543/raket");
    expect(result.directUrl).toBe("postgresql://direct.local:5432/raket");
  });

  it("falls back to DATABASE_URL in development when LOCAL_DATABASE_URL is unset", () => {
    const result = resolveDatabaseUrl(
      env({
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://supabase:supa@db.ref.supabase.co:5432/postgres",
        DIRECT_URL: "postgresql://supabase:supa@db.ref.supabase.co:5432/postgres",
      }),
    );

    expect(result.url).toBe("postgresql://supabase:supa@db.ref.supabase.co:5432/postgres");
    expect(result.directUrl).toBe("postgresql://supabase:supa@db.ref.supabase.co:5432/postgres");
  });

  it("ignores LOCAL_DATABASE_URL when NODE_ENV is production", () => {
    const result = resolveDatabaseUrl(
      env({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://prod:prod@db.example.com:5432/postgres",
        LOCAL_DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/raket",
      }),
    );

    expect(result.url).toBe("postgresql://prod:prod@db.example.com:5432/postgres");
  });

  it("ignores LOCAL_DATABASE_URL when NODE_ENV is test", () => {
    const result = resolveDatabaseUrl(
      env({
        NODE_ENV: "test",
        DATABASE_URL: "postgresql://test:test@db.example.com:5432/postgres",
        LOCAL_DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/raket",
      }),
    );

    expect(result.url).toBe("postgresql://test:test@db.example.com:5432/postgres");
  });
});
