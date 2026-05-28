import { initQueryClient } from "@ts-rest/react-query";
import { tsRestFetchApi, type ApiFetcherArgs } from "@ts-rest/core";
import { contract } from "@raket/contracts";
import { env } from "./env";
import { authHeader } from "./auth";

export async function authedFetcher(args: ApiFetcherArgs): ReturnType<typeof tsRestFetchApi> {
  const { authorization } = await authHeader();
  args.headers.authorization = authorization;
  return tsRestFetchApi(args);
}

export const api = initQueryClient(contract, {
  baseUrl: env.EXPO_PUBLIC_API_URL,
  // Declares authorization as a base header so ts-rest doesn't require it
  // per-call. The authedFetcher overwrites the value with the live Supabase
  // session token before every request.
  baseHeaders: { authorization: "" },
  api: authedFetcher,
});
