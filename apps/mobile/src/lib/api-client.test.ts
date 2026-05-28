import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./auth", () => ({
  authHeader: vi.fn(),
}));

vi.mock("@ts-rest/core", () => ({
  tsRestFetchApi: vi.fn(),
}));

vi.mock("@raket/contracts", () => ({ contract: {} }));
vi.mock("@ts-rest/react-query", () => ({ initQueryClient: vi.fn(() => ({})) }));

const VALID_ENV = {
  EXPO_PUBLIC_API_URL: "https://api.example.test",
  EXPO_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  EXPO_PUBLIC_SUPABASE_ANON_KEY: "anon-key-12345",
  EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_12345",
};

describe("lib/api-client — authedFetcher", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv, ...VALID_ENV };
    delete process.env.EXPO_PUBLIC_DEV_BEARER;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("injects the Bearer token from the active session before fetching", async () => {
    const { authHeader } = await import("./auth");
    const { tsRestFetchApi } = await import("@ts-rest/core");
    vi.mocked(authHeader).mockResolvedValue({ authorization: "Bearer live-token" });
    vi.mocked(tsRestFetchApi).mockResolvedValue({ status: 200, body: {}, headers: new Headers() });

    const { authedFetcher } = await import("./api-client");
    const fakeArgs = { headers: {} as Record<string, string> };
    await authedFetcher(fakeArgs as never);

    expect(fakeArgs.headers.authorization).toBe("Bearer live-token");
    expect(tsRestFetchApi).toHaveBeenCalledWith(fakeArgs);
  });

  it("sets an empty authorization header when no session exists", async () => {
    const { authHeader } = await import("./auth");
    const { tsRestFetchApi } = await import("@ts-rest/core");
    vi.mocked(authHeader).mockResolvedValue({ authorization: "" });
    vi.mocked(tsRestFetchApi).mockResolvedValue({ status: 200, body: {}, headers: new Headers() });

    const { authedFetcher } = await import("./api-client");
    const fakeArgs = { headers: {} as Record<string, string> };
    await authedFetcher(fakeArgs as never);

    expect(fakeArgs.headers.authorization).toBe("");
  });
});
