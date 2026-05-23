import { initClient } from "@ts-rest/core";
import { contract } from "@raket/contracts";
import { env } from "./env";

export const api = initClient(contract, {
  baseUrl: env.EXPO_PUBLIC_API_URL,
});
