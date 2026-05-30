import type { PayoutLandedEvent } from "./types";

/** Number of timeline steps shown in the settlement animation (matches the mock). */
export const SETTLEMENT_STEP_COUNT = 6;

/**
 * Per-step dwell time in ms, copied from the `settlement-animation.html` mock.
 * Sums to ~5.1s end-to-end, satisfying the "plays end-to-end in ~5s" criterion.
 * The ticket says "~700ms each"; the mock uses variable timings to make the
 * on-chain step feel weightier, so we match the mock.
 */
export const SETTLEMENT_STEP_TIMINGS_MS = [400, 1400, 1000, 900, 700, 700] as const;

/** TanStack Query keys to invalidate once money has landed, so the UI refetches. */
export const SETTLEMENT_INVALIDATE_KEYS = [["dashboard"], ["invoices"]] as const;

/** Sensible demo defaults for fields the realtime `payouts` row doesn't carry. */
export const SETTLEMENT_DEFAULTS = {
  amountUsd: 1600,
  clientName: "your client",
  fxRate: 55.85,
  txHash: "0xa8c2···3f9d",
  gcashLast4: "1234",
} as const;

/** Resolve an event's optional fields against the demo defaults. */
export function withDefaults(event: PayoutLandedEvent): Required<PayoutLandedEvent> {
  return {
    payoutId: event.payoutId,
    amountPhp: event.amountPhp,
    amountUsd: event.amountUsd ?? SETTLEMENT_DEFAULTS.amountUsd,
    clientName: event.clientName ?? SETTLEMENT_DEFAULTS.clientName,
    fxRate: event.fxRate ?? SETTLEMENT_DEFAULTS.fxRate,
    txHash: event.txHash ?? SETTLEMENT_DEFAULTS.txHash,
    gcashLast4: event.gcashLast4 ?? SETTLEMENT_DEFAULTS.gcashLast4,
  };
}
