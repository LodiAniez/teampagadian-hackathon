import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { ErrorResponseSchema } from "../shared/error";
import { PublicInvoiceResponseSchema } from "./public-invoices.schema";

const c = initContract();

export const publicInvoicesContract = c.router(
  {
    getByToken: {
      method: "GET",
      path: "/:token",
      pathParams: z.object({ token: z.string().min(1) }),
      responses: {
        200: PublicInvoiceResponseSchema,
        404: ErrorResponseSchema,
      },
      summary: "Public invoice view by share token (no auth)",
    },
  },
  { pathPrefix: "/public/invoices", strictStatusCodes: true },
);
