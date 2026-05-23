import { z } from "zod";
import type { CheckoutCompletedEvent, PaymentSucceededEvent } from "../../payments/payments.types";

/**
 * Zod schemas + mappers at the Stripe → domain trust boundary.
 *
 * StripeService.constructEvent returns a narrow envelope ({ id, type,
 * data.object: unknown }). These mappers parse `data.object` per event type
 * and produce the domain shapes that PaymentsService consumes — Stripe SDK
 * types never cross the slice boundary (per docs/api-convention.md §8).
 */

const PaymentIntentPayloadSchema = z.object({
  id: z.string(),
  amount_received: z.number(), // cents
  currency: z.string(),
  latest_charge: z.string().nullable(),
  created: z.number(), // unix seconds
  metadata: z.object({
    invoice_id: z.string(),
  }),
});

const CheckoutSessionPayloadSchema = z.object({
  id: z.string(),
  payment_intent: z.string(),
  metadata: z.object({
    invoice_id: z.string(),
  }),
});

export function toPaymentSucceededEvent(object: unknown): PaymentSucceededEvent {
  const pi = PaymentIntentPayloadSchema.parse(object);
  return {
    stripePaymentIntentId: pi.id,
    stripeChargeId: pi.latest_charge,
    amountReceived: pi.amount_received / 100, // cents → major units
    amountReceivedCurrency: pi.currency.toUpperCase(),
    invoiceId: pi.metadata.invoice_id,
    paidAt: new Date(pi.created * 1000),
  };
}

export function toCheckoutCompletedEvent(object: unknown): CheckoutCompletedEvent {
  const session = CheckoutSessionPayloadSchema.parse(object);
  return {
    stripeSessionId: session.id,
    stripePaymentIntentId: session.payment_intent,
    invoiceId: session.metadata.invoice_id,
  };
}
