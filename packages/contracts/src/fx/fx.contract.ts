import { initContract } from "@ts-rest/core";
import { ErrorResponseSchema } from "../shared/error";
import { FxComparisonSchema, FxCompareQuerySchema } from "./fx.schema";

const c = initContract();

export const fxContract = c.router(
  {
    compare: {
      method: "GET",
      path: "/compare",
      query: FxCompareQuerySchema,
      responses: {
        200: FxComparisonSchema,
        400: ErrorResponseSchema,
      },
      summary: "Compare what a USD amount nets via Raket vs PayPal/Wise/bank wire",
    },
  },
  {
    // Public calculator — no auth headers, unlike the dashboard contract.
    pathPrefix: "/fx",
    strictStatusCodes: true,
  },
);
