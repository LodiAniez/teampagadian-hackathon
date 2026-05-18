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
  const query = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const token = getToken();
      const result = await api.auth.me({
        headers: { authorization: token ? `Bearer ${token}` : "" },
      });

      if (result.status !== 200) {
        throw new Error("Unauthorized");
      }
      return result.body;
    },
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error) =>
      failureCount < 1 && !(error instanceof Error && error.message === "Unauthorized"),
  });

  return {
    user: query.data ?? null,
    isLoading: query.isPending,
    error: query.error instanceof Error ? query.error : null,
  };
}
