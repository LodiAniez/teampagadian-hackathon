import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api/auth.api", () => ({
  api: { auth: { me: vi.fn() } },
}));
vi.mock("@/lib/auth", () => ({ getToken: vi.fn() }));

import { api } from "../api/auth.api";
import { getToken } from "@/lib/auth";
import { useAuth } from "./use-auth";

const mockMe = vi.mocked(api.auth.me);
const mockGetToken = vi.mocked(getToken);

const stubUser = {
  id: "00000000-0000-0000-0000-000000000001",
  phone: "+639171234567",
  name: "Test User",
  businessName: null,
  defaultCurrency: "PHP",
  defaultHourlyRate: null,
  bir2303Election: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips the fetch when there is no token", () => {
    mockGetToken.mockReturnValue(null);

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    expect(result.current.user).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(mockMe).not.toHaveBeenCalled();
  });

  it("returns user data on a successful fetch", async () => {
    mockGetToken.mockReturnValue("valid-token");
    mockMe.mockResolvedValue({ status: 200, body: stubUser } as never);

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.user).toEqual(stubUser));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mockMe).toHaveBeenCalledWith({
      headers: { authorization: "Bearer valid-token" },
    });
  });

  it("returns an error when the API responds with non-200", async () => {
    mockGetToken.mockReturnValue("expired-token");
    mockMe.mockResolvedValue({
      status: 401,
      body: { message: "Unauthorized" },
    } as never);

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    expect(result.current.error?.message).toBe("Unauthorized");
    expect(result.current.user).toBeNull();
  });
});
