import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const verifyOtpMock = vi.fn();
const pushMock = vi.fn();
const setAccessTokenMock = vi.fn();

vi.mock("@/lib/api-client", () => ({
  api: { auth: { verifyOtp: (...args: unknown[]) => verifyOtpMock(...args) } },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));
vi.mock("@/lib/auth", () => ({
  setAccessToken: (...args: unknown[]) => setAccessTokenMock(...args),
}));

import { useOtpVerify } from "./use-otp-verify";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const phone = "+639171234567";
const mockUser = {
  id: "user-id",
  phone,
  name: null,
  businessName: null,
  defaultCurrency: "USD",
  defaultHourlyRate: null,
  bir2303Election: null,
  createdAt: "2026-05-19T00:00:00.000Z",
  updatedAt: "2026-05-19T00:00:00.000Z",
};

describe("useOtpVerify", () => {
  beforeEach(() => {
    verifyOtpMock.mockReset();
    pushMock.mockReset();
    setAccessTokenMock.mockReset();
  });

  it("auto-submits when 6 digits are entered and routes new users to /setup-profile", async () => {
    verifyOtpMock.mockResolvedValue({
      status: 200,
      body: { user: mockUser, accessToken: "jwt-token", isNewUser: true },
    });

    const { result } = renderHook(() => useOtpVerify({ phone }), { wrapper });

    act(() => result.current.setCode("123456"));

    await waitFor(() => expect(verifyOtpMock).toHaveBeenCalled());
    expect(verifyOtpMock).toHaveBeenCalledWith({ body: { phone, code: "123456" } });
    await waitFor(() => expect(setAccessTokenMock).toHaveBeenCalledWith("jwt-token"));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/setup-profile"));
  });

  it("routes existing users to /dashboard", async () => {
    verifyOtpMock.mockResolvedValue({
      status: 200,
      body: { user: mockUser, accessToken: "jwt-token", isNewUser: false },
    });

    const { result } = renderHook(() => useOtpVerify({ phone }), { wrapper });

    act(() => result.current.setCode("123456"));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard"));
  });

  it("clears the code and exposes an inline error on 401", async () => {
    verifyOtpMock.mockResolvedValue({
      status: 401,
      body: { code: "UNAUTHORIZED", message: "Invalid code" },
    });

    const { result } = renderHook(() => useOtpVerify({ phone }), { wrapper });

    act(() => result.current.setCode("999999"));

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.code).toBe("");
    expect(setAccessTokenMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("does not submit while fewer than 6 digits are entered", async () => {
    const { result } = renderHook(() => useOtpVerify({ phone }), { wrapper });

    act(() => result.current.setCode("12345"));
    await new Promise((r) => setTimeout(r, 10));

    expect(verifyOtpMock).not.toHaveBeenCalled();
  });
});
