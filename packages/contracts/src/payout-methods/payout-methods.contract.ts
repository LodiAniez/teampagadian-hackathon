import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { ErrorResponseSchema } from "../shared/error";
import {
  AddPayoutMethodBodySchema,
  PayoutMethodSchema,
  SetupIntentResponseSchema,
} from "./payout-methods.schema";

const c = initContract();

const authedHeaders = z.object({
  authorization: z.string().startsWith("Bearer "),
});

export const payoutMethodsContract = c.router(
  {
    list: {
      method: "GET",
      path: "/",
      responses: {
        200: z.array(PayoutMethodSchema),
        401: ErrorResponseSchema,
      },
      summary: "List all payout methods for the authenticated user",
    },
    add: {
      method: "POST",
      path: "/",
      body: AddPayoutMethodBodySchema,
      responses: {
        201: PayoutMethodSchema,
        401: ErrorResponseSchema,
        422: ErrorResponseSchema,
      },
      summary: "Add a new payout method (freshness-gated)",
    },
    setupIntent: {
      method: "POST",
      path: "/setup-intent",
      body: c.noBody(),
      responses: {
        200: SetupIntentResponseSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      summary:
        "Create a Stripe SetupIntent for card tokenization (no freshness gate — fresh OTP gated at /add)",
    },
    setDefault: {
      method: "PATCH",
      path: "/:id/default",
      pathParams: z.object({ id: z.string().uuid() }),
      body: z.undefined(),
      responses: {
        200: PayoutMethodSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
      summary: "Set a payout method as the default",
    },
    remove: {
      method: "DELETE",
      path: "/:id",
      pathParams: z.object({ id: z.string().uuid() }),
      body: z.undefined(),
      responses: {
        204: z.undefined(),
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
      summary: "Remove a payout method",
    },
  },
  {
    pathPrefix: "/payout-methods",
    baseHeaders: authedHeaders,
    strictStatusCodes: true,
  },
);
