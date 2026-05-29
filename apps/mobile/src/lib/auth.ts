import { useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { createClient, type Session } from "@supabase/supabase-js";
import { env } from "./env";

export const supabase = createClient(
  env.EXPO_PUBLIC_SUPABASE_URL,
  env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      storage: {
        getItem: (key) => SecureStore.getItemAsync(key),
        setItem: (key, value) => SecureStore.setItemAsync(key, value),
        removeItem: (key) => SecureStore.deleteItemAsync(key),
      },
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function authHeader(): Promise<{ authorization: string }> {
  const token = await getAccessToken();
  return { authorization: token ? `Bearer ${token}` : "" };
}

type SessionState = { session: Session | null; isLoading: boolean };

// Wraps supabase.auth.getSession() with a catch that treats rejection as
// "no session" so a failed lookup (network down, SecureStore wiped after an
// emulator reset, etc.) falls through to the login screen instead of leaving
// useSession stuck on isLoading=true forever. Exported so the rejection path
// is unit-testable in the node vitest env (the hook itself needs a renderer).
export async function resolveInitialSession(): Promise<{ session: Session | null }> {
  try {
    const { data } = await supabase.auth.getSession();
    return { session: data.session };
  } catch (err) {
    console.warn("[auth] getSession failed:", err);
    return { session: null };
  }
}

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ session: null, isLoading: true });

  useEffect(() => {
    let active = true;

    resolveInitialSession().then(({ session }) => {
      if (!active) return;
      setState({ session, isLoading: false });
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setState({ session, isLoading: false });
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return state;
}
