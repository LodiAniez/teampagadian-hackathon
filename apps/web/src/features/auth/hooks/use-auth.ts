import { getToken } from "@/lib/auth";
import type { User } from "@raket/contracts";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/auth.api";

export type UseAuthResult = {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
};

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

export function useAuth(): UseAuthResult {
  // Token is read at render time. After login the OTP hook calls router.push,
  // which remounts this hook and re-evaluates `enabled`. If that implicit
  // remount ever goes away, invalidate ["auth","me"] from the login handler instead.
  const token = getToken();
  const query = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const result = await api.auth.me({
        headers: { authorization: `Bearer ${token}` },
      });

      if (result.status === 401) {
        throw new UnauthorizedError();
      }
      if (result.status !== 200) {
        throw new Error("Unexpected response from /auth/me");
      }
      return result.body;
    },
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error) => failureCount < 1 && !(error instanceof UnauthorizedError),
  });

  return {
    user: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error : null,
  };
}
