import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { ErrorResponseSchema } from "../shared/error";
import { GetAnnualQuerySchema, GetQuarterlyQuerySchema, TaxComputationSchema } from "./tax.schema";

const c = initContract();

const authedHeaders = z.object({
  authorization: z.string().startsWith("Bearer "),
});

export const taxContract = c.router(
  {
    getQuarterly: {
      method: "GET",
      path: "/quarterly",
      query: GetQuarterlyQuerySchema,
      responses: {
        200: TaxComputationSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
        422: ErrorResponseSchema,
      },
      summary: "Compute 1701Q quarterly income tax for the authenticated user",
    },
    getAnnual: {
      method: "GET",
      path: "/annual",
      query: GetAnnualQuerySchema,
      responses: {
        200: TaxComputationSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
        422: ErrorResponseSchema,
      },
      summary: "Compute 1701/1701A annual income tax for the authenticated user",
    },
  },
  {
    pathPrefix: "/tax",
    baseHeaders: authedHeaders,
    strictStatusCodes: true,
  },
);
