"use client";

import {
  createContext,
  useContext,
  useEffect,
} from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AuthContext as AuthCtx } from "../types/auth";
import { authService } from "../lib/services/auth.service";
import { clearToken } from "../lib/auth-cookie";

type Props = {
  children: React.ReactNode;
};

const AuthContext = createContext<AuthCtx>({
  user: null,
  isLoading: true,
  logout: async () => {},
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
  const {
    data,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: authService.me,
    retry: false,
  });

  const user = data ?? null;

  /**
   * GLOBAL AUTH FAILURE HANDLER
   * If /me fails → treat as unauthenticated
   */
  useEffect(() => {
    if (isError) {
      clearToken();
      queryClient.removeQueries({ queryKey: ["auth", "me"] });
      router.push("/login");
    }
  }, [isError]);

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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);