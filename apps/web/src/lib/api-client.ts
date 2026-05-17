import { initClient } from "@ts-rest/core";
import { contract } from "@raket/contracts";
import { env } from "./env";

// Single typed ts-rest client, callable from anywhere. Hooks wrap calls with
// tanstack-query's useQuery/useMutation. See docs/web-convention.md §4.
export const api = initClient(contract, {
  baseUrl: env.NEXT_PUBLIC_API_URL,
  baseHeaders: {
    "Content-Type": "application/json",
  },
});
