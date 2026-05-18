"use client";

import {
  createContext,
  useContext,
  useEffect,
} from "react";
import { useRouter } from "next/navigation";
import {  useQueryClient } from "@tanstack/react-query";
import { clearToken } from "@/lib/auth";
import {useAuth, type UseAuthResult as UseAuthContext} from "@/features/auth/hooks/use-auth"

type Props = {
  children: React.ReactNode;
};

interface AuthCtx extends UseAuthContext {
  logout: () => void,
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  isLoading: true,
  logout: async () => { },
  error: null
});

export function AuthProvider({ children }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();

  /**
   * MAIN SOURCE OF TRUTH: /auth/me
   * TanStack Query handles:
   * - caching
   * - background refetch
   * - retry control
   */
  const {error, isLoading, user} = useAuth()

  /**
   * GLOBAL AUTH FAILURE HANDLER
   * If /me fails → treat as unauthenticated
   */
  useEffect(() => {
    if (error) {
      clearToken();
      queryClient.removeQueries({ queryKey: ["auth", "me"] });
      router.push("/login");
    }
  }, [error]);

  /**
   * LOGOUT
   */
  const logout = async () => {
    clearToken();
    queryClient.removeQueries({ queryKey: ["auth", "me"] });
    router.push("/login");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        logout,
        error
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuthContext = () => useContext(AuthContext);  