import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ReactNode } from "react";

const requestOtpMock = vi.fn();

vi.mock("@/lib/api-client", () => ({
  api: { auth: { requestOtp: (...args: unknown[]) => requestOtpMock(...args) } },
}));
vi.mock("sonner", () => ({
  toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

import { useResendOtp } from "./use-resend-otp";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useResendOtp", () => {
  beforeEach(() => {
    requestOtpMock.mockReset();
    vi.mocked(toast.info).mockReset();
    vi.mocked(toast.error).mockReset();
    vi.mocked(toast.success).mockReset();
  });

  it("calls requestOtp with the phone and surfaces devOtpCode in a toast", async () => {
    requestOtpMock.mockResolvedValue({
      status: 200,
      body: { success: true, expiresInSeconds: 300, devOtpCode: "123456" },
    });

    const { result } = renderHook(() => useResendOtp({ phone: "+639171234567" }), { wrapper });

    await act(async () => {
      await result.current.resend();
    });

    expect(requestOtpMock).toHaveBeenCalledWith({ body: { phone: "+639171234567" } });
    await waitFor(() =>
      expect(vi.mocked(toast.info)).toHaveBeenCalledWith(expect.stringContaining("123456")),
    );
  });

  it("surfaces a toast.error and does not call onSuccess when the API returns a non-200", async () => {
    requestOtpMock.mockResolvedValue({ status: 500, body: { message: "boom" } });
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useResendOtp({ phone: "+639171234567", onSuccess }), {
      wrapper,
    });

    await act(async () => {
      await result.current.resend().catch(() => {});
    });

    await waitFor(() => expect(vi.mocked(toast.error)).toHaveBeenCalled());
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
