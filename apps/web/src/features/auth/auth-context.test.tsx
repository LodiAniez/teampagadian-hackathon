import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: vi.fn() }));
vi.mock("./hooks/use-auth", () => ({
  useAuth: vi.fn(),
  UnauthorizedError: class UnauthorizedError extends Error {},
}));
vi.mock("@/lib/auth", () => ({ clearToken: vi.fn() }));

import { useRouter } from "next/navigation";
import { clearToken } from "@/lib/auth";
import { useAuth, UnauthorizedError } from "./hooks/use-auth";
import { AuthProvider, useAuthContext } from "./auth-context";

const mockPush = vi.fn();
const mockUseRouter = vi.mocked(useRouter);
const mockUseAuth = vi.mocked(useAuth);
const mockClearToken = vi.mocked(clearToken);

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
  const client = new QueryClient();
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRouter.mockReturnValue({ push: mockPush } as never);
    mockUseAuth.mockReturnValue({ user: null, isLoading: false, error: null });
  });

  it("redirects to /login and clears token only on UnauthorizedError", async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      error: new UnauthorizedError(),
    });

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <AuthProvider>
          <div />
        </AuthProvider>
      </Wrapper>,
    );

    await waitFor(() => {
      expect(mockClearToken).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/login");
    });
  });

  it("does not redirect on generic (non-401) errors", async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      error: new Error("Network error"),
    });

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <AuthProvider>
          <div />
        </AuthProvider>
      </Wrapper>,
    );

    await new Promise((r) => setTimeout(r, 50));
    expect(mockClearToken).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("clears token and redirects to /login when logout is called", () => {
    let capturedLogout: (() => void) | undefined;

    function Consumer() {
      const { logout } = useAuthContext();
      capturedLogout = logout;
      return null;
    }

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <AuthProvider>
          <Consumer />
        </AuthProvider>
      </Wrapper>,
    );

    act(() => {
      capturedLogout?.();
    });

    expect(mockClearToken).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/login");
  });

  it("exposes the authenticated user to consumers", () => {
    mockUseAuth.mockReturnValue({ user: stubUser, isLoading: false, error: null });

    let capturedUser: unknown;
    function Consumer() {
      const { user } = useAuthContext();
      capturedUser = user;
      return null;
    }

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <AuthProvider>
          <Consumer />
        </AuthProvider>
      </Wrapper>,
    );

    expect(capturedUser).toEqual(stubUser);
  });
});
