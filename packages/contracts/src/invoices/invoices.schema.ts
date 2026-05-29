import { z } from "zod";
import { ClientSchema } from "../clients/clients.schema";
import { SupportedCurrencySchema } from "../shared/money";

export const InvoiceStatusSchema = z.enum(["draft", "sent", "paid", "overdue", "void"]);
export type InvoiceStatus = z.infer<typeof InvoiceStatusSchema>;

export const InvoiceSourceTypeSchema = z.enum(["text", "upload", "manual"]);
export type InvoiceSourceType = z.infer<typeof InvoiceSourceTypeSchema>;

export const InvoiceLineItemSchema = z.object({
  id: z.string().uuid(),
  description: z.string().min(1).max(500),
  quantity: z.number().positive(),
  unit: z.string().max(32),
  rate: z.number().nonnegative(),
  amount: z.number().nonnegative(),
});
export type InvoiceLineItem = z.infer<typeof InvoiceLineItemSchema>;

export const InvoiceSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  client: ClientSchema,
  number: z.string(),
  status: InvoiceStatusSchema,
  amount: z.number().nonnegative(),
  currency: SupportedCurrencySchema,
  issueDate: z.string().date(),
  dueDate: z.string().date(),
  sourceType: InvoiceSourceTypeSchema,
  lineItems: z.array(InvoiceLineItemSchema),
  stripePaymentIntentId: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type Invoice = z.infer<typeof InvoiceSchema>;

// Slim projection for list/dashboard views. clientName flattened, line items
// omitted, internal fields (sourceType, stripe ids, userId) dropped. amountPhp
// is the latest SETTLED payment's PHP amount, null until on-chain settlement.
export const InvoiceListItemSchema = z.object({
  id: z.string().uuid(),
  number: z.string(),
  status: InvoiceStatusSchema,
  clientName: z.string(),
  amount: z.number().nonnegative(),
  currency: SupportedCurrencySchema,
  amountPhp: z.number().nonnegative().nullable(),
  issueDate: z.string().date(),
  dueDate: z.string().date(),
  createdAt: z.string().datetime(),
});
export type InvoiceListItem = z.infer<typeof InvoiceListItemSchema>;

export const CreateInvoiceLineItemSchema = InvoiceLineItemSchema.omit({
  id: true,
  amount: true,
});
export type CreateInvoiceLineItem = z.infer<typeof CreateInvoiceLineItemSchema>;

export const CreateInvoiceBodySchema = z
  .object({
    clientId: z.string().uuid().optional(),
    clientName: z.string().trim().min(1).max(200).optional(),
    clientEmail: z.string().email().optional(),
    clientCountry: z.string().length(2).optional(),
    currency: SupportedCurrencySchema,
    issueDate: z.string().date(),
    dueDate: z.string().date(),
    sourceType: InvoiceSourceTypeSchema,
    lineItems: z.array(CreateInvoiceLineItemSchema).min(1),
  })
  .refine((d) => (d.clientId === undefined) !== (d.clientName === undefined), {
    message: "Provide exactly one of clientId or clientName",
  });
export type CreateInvoiceBody = z.infer<typeof CreateInvoiceBodySchema>;

export const ParseInvoiceTextBodySchema = z.object({
  text: z.string().min(1).max(2000),
  defaultCurrency: SupportedCurrencySchema.optional(),
});
export type ParseInvoiceTextBody = z.infer<typeof ParseInvoiceTextBodySchema>;

// Multipart upload: file is validated server-side via FileInterceptor + MIME
// check (it can't live in the Zod body because ts-rest doesn't model file parts).
// Only the text fields belong here.
export const ParseQuotationBodySchema = z.object({
  defaultCurrency: SupportedCurrencySchema.optional(),
});
export type ParseQuotationBody = z.infer<typeof ParseQuotationBodySchema>;

export const QUOTATION_MIME_TYPES = ["application/pdf", "image/png", "image/jpeg"] as const;
export type QuotationMimeType = (typeof QUOTATION_MIME_TYPES)[number];
export const QUOTATION_MAX_BYTES = 5 * 1024 * 1024;

export const ParsedInvoiceLineItemSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().positive().nullable(),
  unit: z.string().max(32).nullable(),
  rate: z.number().nonnegative().nullable(),
  amount: z.number().nonnegative().nullable(),
});
export type ParsedInvoiceLineItem = z.infer<typeof ParsedInvoiceLineItemSchema>;

export const ParsedInvoiceDraftSchema = z.object({
  clientName: z.string().nullable(),
  clientEmail: z.string().email().nullable(),
  currency: SupportedCurrencySchema,
  issueDate: z.string().date(),
  dueDate: z.string().date().nullable(),
  lineItems: z.array(ParsedInvoiceLineItemSchema),
  warnings: z.array(z.string()),
});
export type ParsedInvoiceDraft = z.infer<typeof ParsedInvoiceDraftSchema>;

export const SendInvoiceBodySchema = z.object({
  clientEmail: z.string().email(),
});
export type SendInvoiceBody = z.infer<typeof SendInvoiceBodySchema>;

export const SendInvoiceResponseSchema = z.object({
  invoice: InvoiceSchema,
  checkoutUrl: z.string().url(),
  qrCodeDataUrl: z.string().startsWith("data:image/"),
});
export type SendInvoiceResponse = z.infer<typeof SendInvoiceResponseSchema>;
