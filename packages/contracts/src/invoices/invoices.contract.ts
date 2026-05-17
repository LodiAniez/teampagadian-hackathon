import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { ErrorResponseSchema } from "../shared/error";
import {
  PaginatedResponseSchema,
  PaginationQuerySchema,
} from "../shared/pagination";
import {
  CreateInvoiceBodySchema,
  InvoiceSchema,
  InvoiceStatusSchema,
  ParseInvoiceTextBodySchema,
  ParsedInvoiceDraftSchema,
  SendInvoiceBodySchema,
  SendInvoiceResponseSchema,
} from "./invoices.schema";

const c = initContract();

const authedHeaders = z.object({
  authorization: z.string().startsWith("Bearer "),
});

export const invoicesContract = c.router(
  {
    list: {
      method: "GET",
      path: "/",
      query: PaginationQuerySchema.extend({
        status: InvoiceStatusSchema.optional(),
        clientId: z.string().uuid().optional(),
      }),
      responses: {
        200: PaginatedResponseSchema(InvoiceSchema),
        401: ErrorResponseSchema,
      },
      summary: "List invoices for the authenticated user",
    },
    getById: {
      method: "GET",
      path: "/:invoiceId",
      pathParams: z.object({ invoiceId: z.string().uuid() }),
      responses: {
        200: InvoiceSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
      summary: "Get a single invoice by id",
    },
    create: {
      method: "POST",
      path: "/",
      body: CreateInvoiceBodySchema,
      responses: {
        201: InvoiceSchema,
        401: ErrorResponseSchema,
        422: ErrorResponseSchema,
      },
      summary: "Create a new invoice in draft status",
    },
    parseText: {
      method: "POST",
      path: "/parse-text",
      body: ParseInvoiceTextBodySchema,
      responses: {
        200: ParsedInvoiceDraftSchema,
        401: ErrorResponseSchema,
        422: ErrorResponseSchema,
      },
      summary: "Parse a plain-text description into an invoice draft via Claude",
    },
    send: {
      method: "POST",
      path: "/:invoiceId/send",
      pathParams: z.object({ invoiceId: z.string().uuid() }),
      body: SendInvoiceBodySchema,
      responses: {
        200: SendInvoiceResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
        409: ErrorResponseSchema,
      },
      summary: "Send an invoice via email, returning checkout URL + QR",
    },
    void: {
      method: "POST",
      path: "/:invoiceId/void",
      pathParams: z.object({ invoiceId: z.string().uuid() }),
      body: c.noBody(),
      responses: {
        200: InvoiceSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
        409: ErrorResponseSchema,
      },
      summary: "Void an invoice that hasn't been paid",
    },
  },
  {
    pathPrefix: "/invoices",
    baseHeaders: authedHeaders,
    strictStatusCodes: true,
  },
);
