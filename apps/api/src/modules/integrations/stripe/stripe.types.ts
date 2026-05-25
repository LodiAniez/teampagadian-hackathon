import type Stripe from "stripe";

/**
 * Narrow structural type of the Stripe SDK surface StripeService consumes.
 *
 * Production wiring provides `new Stripe(...)` which satisfies this shape via
 * structural typing — `setupIntents.create` returns `Stripe.Response<Stripe.SetupIntent>`
 * which extends `{ id, client_secret }`, so it's assignable to the narrowed
 * return type below.
 *
 * Tests provide a hand-rolled mock satisfying the same shape — no type-escape
 * hatches needed (precommit hook blocks them anyway).
 */
export interface StripeClient {
  setupIntents: {
    create(
      params: Stripe.SetupIntentCreateParams,
    ): Promise<{ id: string; client_secret: string | null }>;
  };
  paymentMethods: {
    retrieve(id: string): Promise<{
      id: string;
      type: string;
      customer?: string | { id: string } | null;
      card?: {
        brand: string;
        last4: string;
        exp_month: number;
        exp_year: number;
      } | null;
    }>;
  };
  webhooks: {
    constructEvent(payload: string | Buffer, header: string, secret: string): WebhookEvent;
  };
}

/**
 * Narrowed shape of a verified Stripe webhook event.
 *
 * Stripe.Event is a sprawling discriminated union (200+ event types). We
 * narrow to just what the webhook controller actually reads — id (logging),
 * type (dispatch), data.object (handed to a Zod-validating mapper per
 * docs/api-convention.md §8 trust-boundary guidance).
 *
 * Production wiring: Stripe.Event is structurally assignable to this shape.
 * Tests: hand-rolled minimal events satisfy the same shape without casts.
 */
export interface WebhookEvent {
  id: string;
  type: string;
  data: { object: unknown };
}

/**
 * Domain shape returned by StripeService.createSetupIntent. We do not leak
 * Stripe.SetupIntent across the integration boundary (per docs/api-convention.md §8).
 */
export interface SetupIntentResult {
  setupIntentId: string;
  clientSecret: string;
}

export const STRIPE_CLIENT = Symbol("STRIPE_CLIENT");
