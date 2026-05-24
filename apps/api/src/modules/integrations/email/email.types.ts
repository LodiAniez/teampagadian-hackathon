export const RESEND_CLIENT = Symbol("RESEND_CLIENT");

/**
 * Narrow structural type of the Resend SDK surface EmailService consumes.
 *
 * Production wiring provides `new Resend(apiKey)` which satisfies this shape via
 * structural typing. Tests provide a hand-rolled mock with `emails.send` only —
 * no other Resend resources are touched by this service.
 *
 * Mirrors the StripeClient pattern in ../stripe/stripe.types.ts.
 */
export interface ResendClient {
  emails: {
    send(payload: ResendSendPayload): Promise<ResendSendResponse>;
  };
}

export interface ResendSendPayload {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

/**
 * Resend's `emails.send` returns a discriminated `{ data, error }` envelope.
 * EmailService unwraps this into a clean domain shape and throws on `error`.
 */
export type ResendSendResponse =
  | { data: { id: string }; error: null }
  | { data: null; error: { message: string; name: string; statusCode: number | null } };

/**
 * Narrow shape of an invoice for email rendering. Defined here (not imported
 * from Prisma) so the template stays testable with plain fixtures and the
 * service stays decoupled from the schema. Callers (TEA-37) map Prisma → this.
 */
export interface InvoiceEmailData {
  number: string;
  amount: string; // formatted display string (e.g. "1,500.00") — caller decides formatting
  currency: string; // ISO-4217 (e.g. "USD")
  dueDate: string; // formatted display string (e.g. "May 30, 2026")
  lineItems: ReadonlyArray<InvoiceEmailLineItem>;
  clientName: string;
}

export interface InvoiceEmailLineItem {
  description: string;
  amount: string; // formatted display string
}

export interface FreelancerEmailData {
  // Prominent display used in the subject + intro copy ("funds settle to X").
  // Caller decides the preference (typically businessName ?? name).
  displayName: string;
  // Structured signature fields per TEA-36 AC ("name, business name, contact").
  name: string;
  businessName?: string;
  contactEmail: string;
}

export interface SendInvoiceEmailParams {
  invoice: InvoiceEmailData;
  freelancer: FreelancerEmailData;
  paymentUrl: string;
  qrCodeDataUrl: string;
  recipientEmail: string;
}

export interface SendInvoiceEmailResult {
  id: string;
}
