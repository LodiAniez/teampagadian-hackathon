import type { Hex } from "viem";

// DI tokens — strings (not Symbols) so they show up clearly in Nest's
// error messages. Match the pattern used by STRIPE_CLIENT in stripe.types.ts.
export const MORPH_PUBLIC_CLIENT = "MORPH_PUBLIC_CLIENT";
export const MORPH_WALLET_CLIENT = "MORPH_WALLET_CLIENT";
export const SETTLEMENT_CONFIG = "SETTLEMENT_CONFIG";

// Pre-computed inputs SettlementService.settle() consumes. FX math (rate,
// fee amount, fee percent, PHP total) is the orchestrator's job (TEA-42);
// this slice just records what's been computed and drives the on-chain
// transfer + DB writes. Domain shape only — no Stripe SDK types cross this
// boundary (per docs/api-convention.md §8).
export type SettleArgs = {
  paymentIntentId: string;
  stripeChargeId: string | null;
  invoiceId: string;
  amountReceived: number; // major units (e.g. 100.00 for $100)
  amountReceivedCurrency: string; // ISO-4217, uppercase: "USD"
  fxRate: number;
  fxFeeAmount: number; // PHP, major units
  fxFeePercent: number; // decimal fraction (0.0100 = 1%)
  amountPhp: number;
  paidAt: Date;
};

// Static config bundle the service holds — addresses validated by Zod at
// boot, plus the hot wallet's derived address (computed once at module
// construction so the service doesn't have to dig into walletClient.account
// at every call site, which also makes unit testing painless).
export type SettlementConfig = {
  usdcContract: Hex;
  coinsphDeposit: Hex;
  hotWalletAddress: Hex;
};

// Thrown when a payment is permanently un-settleable (FAILED in the DB).
// Caller is responsible for surfacing this to ops; webhooks return non-2xx
// so Stripe stops redelivering.
export class SettlementFailedError extends Error {
  constructor(
    public readonly paymentId: string,
    message?: string,
  ) {
    super(
      message ?? `Settlement permanently failed for payment ${paymentId}; manual recovery required`,
    );
    this.name = "SettlementFailedError";
  }
}
