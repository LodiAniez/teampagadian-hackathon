import { initQueryClient } from "@ts-rest/react-query";
import { contract } from "@raket/contracts";
import { env } from "./env";

export function buildAuthorizationHeader(): string {
  // TODO(TEA-17/18): replace env.EXPO_PUBLIC_DEV_BEARER with getAccessToken() from lib/auth.ts
  // once the login flow + secure-store session land.
  const token = env.EXPO_PUBLIC_DEV_BEARER;
  return token ? `Bearer ${token}` : "";
}

export const api = initQueryClient(contract, {
  baseUrl: env.EXPO_PUBLIC_API_URL,
  baseHeaders: {
    authorization: buildAuthorizationHeader,
  },
});
