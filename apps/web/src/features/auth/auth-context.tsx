"use client";

import { createContext, useCallback, useContext, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { clearToken } from "@/lib/auth";
import { useAuth, type UseAuthResult } from "./hooks/use-auth";

interface AuthCtx extends UseAuthResult {
  logout: () => void;
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  isLoading: true,
  logout: () => {},
  error: null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { error, isLoading, user } = useAuth();

  useEffect(() => {
    if (error) {
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

  return (
    <AuthContext.Provider value={{ user, isLoading, logout, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuthContext = () => useContext(AuthContext);
