import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const updateProfileMock = vi.fn();
const pushMock = vi.fn();

vi.mock("@/lib/api-client", () => ({
  api: { auth: { updateProfile: (...args: unknown[]) => updateProfileMock(...args) } },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { useProfileSetup } from "./use-profile-setup";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const mockUser = {
  id: "user-id",
  phone: "+639171234567",
  name: "Juan dela Cruz",
  businessName: "Juan dela Cruz Freelance",
  defaultCurrency: "USD",
  defaultHourlyRate: { amount: 50, currency: "USD" },
  bir2303Election: "8_percent",
  createdAt: "2026-05-19T00:00:00.000Z",
  updatedAt: "2026-05-19T00:00:00.000Z",
};

describe("useProfileSetup", () => {
  beforeEach(() => {
    updateProfileMock.mockReset();
    pushMock.mockReset();
    localStorage.clear();
  });

  it("submits correct payload and navigates to /dashboard on success", async () => {
    updateProfileMock.mockResolvedValue({ status: 200, body: mockUser });

    const { result } = renderHook(() => useProfileSetup(), { wrapper });

    act(() => {
      result.current.form.setValue("name", "Juan dela Cruz");
      result.current.form.setValue("defaultCurrency", "USD");
      result.current.form.setValue("bir2303Election", "8_percent");
    });

    await act(async () => {
      await result.current.onSubmit();
    });

    await waitFor(() => expect(updateProfileMock).toHaveBeenCalled());
    expect(updateProfileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ name: "Juan dela Cruz" }),
      }),
    );
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard"));
  });

  it("does not submit when name is missing", async () => {
    const { result } = renderHook(() => useProfileSetup(), { wrapper });

    await act(async () => {
      await result.current.onSubmit();
    });

    expect(updateProfileMock).not.toHaveBeenCalled();
  });

  it("defaults businessName to '<name> Freelance' when left blank", async () => {
    updateProfileMock.mockResolvedValue({ status: 200, body: mockUser });

    const { result } = renderHook(() => useProfileSetup(), { wrapper });

    act(() => {
      result.current.form.setValue("name", "Maria Santos");
      result.current.form.setValue("businessName", "");
    });

    await act(async () => {
      await result.current.onSubmit();
    });

    await waitFor(() => expect(updateProfileMock).toHaveBeenCalled());
    expect(updateProfileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ businessName: "Maria Santos Freelance" }),
      }),
    );
  });

  it("restores form values from localStorage on mount", () => {
    localStorage.setItem(
      "raket:setup-profile:draft",
      JSON.stringify({
        name: "Restored Name",
        defaultCurrency: "EUR",
        bir2303Election: "graduated",
      }),
    );

    const { result } = renderHook(() => useProfileSetup(), { wrapper });

    expect(result.current.form.getValues("name")).toBe("Restored Name");
    expect(result.current.form.getValues("defaultCurrency")).toBe("EUR");
    expect(result.current.form.getValues("bir2303Election")).toBe("graduated");
  });

  it("clears localStorage draft after successful submit", async () => {
    updateProfileMock.mockResolvedValue({ status: 200, body: mockUser });
    localStorage.setItem("raket:setup-profile:draft", JSON.stringify({ name: "Draft" }));

    const { result } = renderHook(() => useProfileSetup(), { wrapper });

    act(() => {
      result.current.form.setValue("name", "Juan dela Cruz");
    });

    await act(async () => {
      await result.current.onSubmit();
    });

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard"));
    expect(localStorage.getItem("raket:setup-profile:draft")).toBeNull();
  });
});
