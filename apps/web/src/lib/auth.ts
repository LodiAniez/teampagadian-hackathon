"use client";

import { getSupabaseBrowser } from "./supabase-browser";

export async function getAccessToken(): Promise<string | null> {
  const supabase = getSupabaseBrowser();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function authHeader(): Promise<{ authorization: string }> {
  const token = await getAccessToken();
  return { authorization: token ? `Bearer ${token}` : "" };
}
