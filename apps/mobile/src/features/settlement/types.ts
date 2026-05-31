/**
 * The "money landed" event that drives the settlement animation + toast.
 *
 * Derived from a `payouts` INSERT realtime payload (see `utils/payout-event.ts`)
 * or synthesised by the dev "simulate payment" FAB. Only `amountPhp` is required;
 * everything else has demo-friendly defaults so the animation reads well even when
 * the realtime row doesn't carry it (the physical `payouts` table has no client
 * name / USD amount — those live on the related payment + invoice).
 */
export type PayoutLandedEvent = {
  payoutId: string;
  amountPhp: number;
  amountUsd?: number;
  clientName?: string;
  fxRate?: number;
  txHash?: string;
  gcashLast4?: string;
};

/** A single step in the settlement timeline, resolved against a {@link PayoutLandedEvent}. */
export type SettlementStep = {
  /** Bold line, e.g. "Stripe confirmed". */
  title: string;
  /** Sub line, e.g. "+$1,600.00 USD · Acme Northwind". */
  meta: string;
};

/** The hero copy that swaps as the animation advances. */
export type SettlementHero = {
  title: string;
  sub: string;
};
