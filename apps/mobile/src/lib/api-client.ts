import { initQueryClient } from "@ts-rest/react-query";
import { contract } from "@raket/contracts";
import { env } from "./env";

// TODO(TEA-17/18): make this async and swap env.EXPO_PUBLIC_DEV_BEARER for
// `await getAccessToken()` once lib/auth.ts + expo-secure-store session land.
export function buildAuthorizationHeader(): string {
  const token = env.EXPO_PUBLIC_DEV_BEARER;
  return token ? `Bearer ${token}` : "";
}

export const api = initQueryClient(contract, {
  baseUrl: env.EXPO_PUBLIC_API_URL,
  baseHeaders: {
    authorization: buildAuthorizationHeader,
  },
});
