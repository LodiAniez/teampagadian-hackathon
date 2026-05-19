import { getToken } from "@/lib/auth";
import type { User } from "@raket/contracts";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/auth.api";

export type UseAuthResult = {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
};

export function useAuth(): UseAuthResult {
  const token = getToken();
  const query = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const result = await api.auth.me({
        headers: { authorization: `Bearer ${token}` },
      });

      if (result.status !== 200) {
        throw new Error("Unauthorized");
      }
      return result.body;
    },
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error) =>
      failureCount < 1 && !(error instanceof Error && error.message === "Unauthorized"),
  });

  return {
    user: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error : null,
  };
}
