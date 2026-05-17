import "server-only";
import { initClient } from "@ts-rest/core";
import { contract } from "@raket/contracts";
import { env } from "./env";

// Server-side ts-rest client for use in server components and route handlers.
// Auth header should be added per call from cookies — see lib/auth.ts.
export const serverApi = initClient(contract, {
  baseUrl: env.NEXT_PUBLIC_API_URL,
  baseHeaders: {
    "Content-Type": "application/json",
  },
});
