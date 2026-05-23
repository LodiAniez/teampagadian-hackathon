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

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ session: null, isLoading: true });

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setState({ session: data.session, isLoading: false });
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
