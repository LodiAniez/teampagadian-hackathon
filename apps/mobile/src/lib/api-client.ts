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
  api: authedFetcher,
});
