"use client";

import { createContext, useCallback, useContext, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { clearToken } from "@/lib/auth";
import { useAuth, type UseAuthResult, UnauthorizedError } from "./hooks/use-auth";

interface AuthCtx extends UseAuthResult {
  logout: () => void;
}

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { error, isLoading, user } = useAuth();

  useEffect(() => {
    if (error instanceof UnauthorizedError) {
      clearToken();
      queryClient.removeQueries({ queryKey: ["auth", "me"] });
      router.push("/login");
    }
  }, [error, router, queryClient]);

  const logout = useCallback(() => {
    clearToken();
    queryClient.removeQueries({ queryKey: ["auth", "me"] });
    router.push("/login");
  }, [router, queryClient]);

  const value = useMemo(
    () => ({ user, isLoading, logout, error }),
    [user, isLoading, logout, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuthContext = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used inside AuthProvider");
  return ctx;
};
