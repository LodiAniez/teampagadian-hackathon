import { z } from "zod";
import { SupportedCurrencySchema } from "../shared/money";

export const PublicInvoiceLineItemSchema = z.object({
  description: z.string(),
  quantity: z.number().nonnegative(),
  unit: z.string(),
  rate: z.number().nonnegative(),
  amount: z.number().nonnegative(),
});
export type PublicInvoiceLineItem = z.infer<typeof PublicInvoiceLineItemSchema>;

export const PublicInvoiceStatusSchema = z.enum(["sent", "paid"]);
export type PublicInvoiceStatus = z.infer<typeof PublicInvoiceStatusSchema>;

export const PublicInvoiceResponseSchema = z.object({
  number: z.string(),
  status: PublicInvoiceStatusSchema,
  amount: z.number().nonnegative(),
  currency: SupportedCurrencySchema,
  issueDate: z.string().date(),
  dueDate: z.string().date(),
  freelancer: z.object({
    name: z.string().nullable(),
    businessName: z.string().nullable(),
  }),
  client: z.object({
    name: z.string(),
  }),
  lineItems: z.array(PublicInvoiceLineItemSchema),
  stripeCheckoutUrl: z.string().url().nullable(),
  // Mirrors SendInvoiceResponseSchema.qrCodeDataUrl — keep the two constraints
  // in lockstep so a non-data-URL can't sneak through the public surface.
  qrCodeDataUrl: z.string().startsWith("data:image/").nullable(),
  token: z.string(),
});
export type PublicInvoiceResponse = z.infer<typeof PublicInvoiceResponseSchema>;
