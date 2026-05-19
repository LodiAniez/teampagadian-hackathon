import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ReactNode } from "react";

const requestOtpMock = vi.fn();
const pushMock = vi.fn();

vi.mock("@/lib/api-client", () => ({
  api: { auth: { requestOtp: (...args: unknown[]) => requestOtpMock(...args) } },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));
vi.mock("sonner", () => ({
  toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

import { usePhoneLogin } from "./use-phone-login";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("usePhoneLogin", () => {
  beforeEach(() => {
    requestOtpMock.mockReset();
    pushMock.mockReset();
    vi.mocked(toast.info).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it("submits the E.164 phone (country code + local digits) and routes to /verify on success", async () => {
    requestOtpMock.mockResolvedValue({
      status: 200,
      body: { success: true, expiresInSeconds: 300 },
    });

    const { result } = renderHook(() => usePhoneLogin(), { wrapper });

    act(() => {
      result.current.form.setValue("localNumber", "9171234567");
    });
    await act(async () => {
      await result.current.onSubmit();
    });

    expect(requestOtpMock).toHaveBeenCalledWith({ body: { phone: "+639171234567" } });
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/verify?phone=%2B639171234567"));
  });

  it("surfaces the devOtpCode in a toast when present", async () => {
    requestOtpMock.mockResolvedValue({
      status: 200,
      body: { success: true, expiresInSeconds: 300, devOtpCode: "123456" },
    });

    const { result } = renderHook(() => usePhoneLogin(), { wrapper });

    act(() => result.current.form.setValue("localNumber", "9171234567"));
    await act(async () => {
      await result.current.onSubmit();
    });

    await waitFor(() =>
      expect(vi.mocked(toast.info)).toHaveBeenCalledWith(expect.stringContaining("123456")),
    );
  });

  it("does not submit when the local number is fewer than 10 digits", async () => {
    const { result } = renderHook(() => usePhoneLogin(), { wrapper });

    act(() => result.current.form.setValue("localNumber", "12345"));
    await act(async () => {
      await result.current.onSubmit();
    });

    expect(requestOtpMock).not.toHaveBeenCalled();
  });

  it("surfaces a toast.error and does not navigate when the API returns a non-200", async () => {
    requestOtpMock.mockResolvedValue({ status: 500, body: { message: "boom" } });

    const { result } = renderHook(() => usePhoneLogin(), { wrapper });

    act(() => result.current.form.setValue("localNumber", "9171234567"));
    await act(async () => {
      await result.current.onSubmit().catch(() => {});
    });

    await waitFor(() => expect(vi.mocked(toast.error)).toHaveBeenCalled());
    expect(pushMock).not.toHaveBeenCalled();
  });
});
