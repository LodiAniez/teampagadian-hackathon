/**
 * Domain shapes the PaymentsService consumes — the Stripe SDK types do not
 * cross the integration boundary into this slice (per docs/api-convention.md §8).
 * The Stripe webhook controller (integrations/stripe) maps Stripe.PaymentIntent
 * and Stripe.Checkout.Session to these shapes via Zod-validating mappers
 * before invoking PaymentsService.
 */
export interface PaymentSucceededEvent {
  stripePaymentIntentId: string;
  stripeChargeId: string | null;
  amountReceived: number; // major units (e.g. 100.00 for $100); cents are converted at the mapper
  amountReceivedCurrency: string; // ISO-4217, uppercase: "USD"
  invoiceId: string; // from Stripe PI metadata.invoice_id (required)
  paidAt: Date;
}

export interface CheckoutCompletedEvent {
  stripeSessionId: string;
  stripePaymentIntentId: string;
  invoiceId: string; // from Stripe Session metadata.invoice_id (required)
}
