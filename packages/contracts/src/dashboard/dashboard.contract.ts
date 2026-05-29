import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { ErrorResponseSchema } from "../shared/error";
import {
  EarningsByClientQuerySchema,
  EarningsByClientSchema,
  EarningsByCountrySchema,
  EarningsByMonthQuerySchema,
  EarningsByMonthSchema,
  EarningsSummarySchema,
} from "./dashboard.schema";

const c = initContract();

const authedHeaders = z.object({
  authorization: z.string().startsWith("Bearer "),
});

export const dashboardContract = c.router(
  {
    getSummary: {
      method: "GET",
      path: "/summary",
      responses: {
        200: EarningsSummarySchema,
        401: ErrorResponseSchema,
      },
      summary: "Earnings summary for the authenticated user (KPIs)",
    },
    getEarningsByMonth: {
      method: "GET",
      path: "/earnings-by-month",
      query: EarningsByMonthQuerySchema,
      responses: {
        200: z.array(EarningsByMonthSchema),
        401: ErrorResponseSchema,
      },
      summary: "Earnings bucketed by YYYY-MM for the last N months",
    },
    getEarningsByClient: {
      method: "GET",
      path: "/earnings-by-client",
      query: EarningsByClientQuerySchema,
      responses: {
        200: z.array(EarningsByClientSchema),
        401: ErrorResponseSchema,
      },
      summary: "Top-N clients by total PHP earned",
    },
    getEarningsByCountry: {
      method: "GET",
      path: "/earnings-by-country",
      responses: {
        200: z.array(EarningsByCountrySchema),
        401: ErrorResponseSchema,
      },
      summary: "Earnings grouped by client country (nulls coalesced to 'XX')",
    },
  },
  {
    pathPrefix: "/dashboard",
    baseHeaders: authedHeaders,
    strictStatusCodes: true,
  },
);
