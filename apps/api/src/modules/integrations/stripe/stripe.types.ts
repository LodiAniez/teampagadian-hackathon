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
  webhooks: {
    constructEvent(payload: string | Buffer, header: string, secret: string): Stripe.Event;
  };
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
