
import { authHeader } from "@/lib/auth";
import type { User } from "@raket/contracts";
import  { useQuery } from "@tanstack/react-query";
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
      const result = await api.auth.me({
        headers: await authHeader()
      })

      if(result.status !== 200) {
        throw new Error("Unauthorized user");
      }
      return result.body
    },
    retry: false,
  })

  return {
    user: query.data as User,
    isLoading: query.isPending,
    error: query.error instanceof Error ? query.error : null,
  
  }
}