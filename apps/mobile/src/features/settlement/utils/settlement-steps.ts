import { formatPhp, formatUsd } from "@/lib/format";
import { withDefaults } from "../constants";
import type { PayoutLandedEvent, SettlementHero, SettlementStep } from "../types";

/**
 * Build the 6-step settlement timeline for a landed payout. Static demo copy,
 * with the USD amount + client name templated into the Stripe step and the PHP
 * amount into the final GCash step — the two numbers the audience cares about.
 * Mirrors `docs/mocks/settlement-animation.html`.
 */
export function buildSettlementSteps(event: PayoutLandedEvent): SettlementStep[] {
  const { amountPhp, amountUsd, clientName, fxRate, txHash, gcashLast4 } = withDefaults(event);

  return [
    {
      title: "Stripe confirmed",
      meta: `+${formatUsd(amountUsd)} USD · ${clientName}`,
    },
    {
      title: "Bridging USD to USDC",
      meta: "Hot wallet on Morph L2",
    },
    {
      title: "Settled on Morph (~2s)",
      meta: `tx ${txHash}`,
    },
    {
      title: "Coins.ph converting",
      meta: `USDC to PHP · rate ${fxRate.toFixed(2)}`,
    },
    {
      title: "Sending via InstaPay",
      meta: `To GCash ···· ${gcashLast4}`,
    },
    {
      title: "Delivered to GCash",
      meta: `+${formatPhp(amountPhp)}`,
    },
  ];
}

/** Hero (title + sub) copy that swaps as the animation advances, one per step. */
export function buildSettlementHero(): SettlementHero[] {
  return [
    { title: "Settling your payment", sub: "Stripe to Morph to GCash. Don't close the app." },
    { title: "Bridging on-chain", sub: "USD card cleared. Sending USDC on Morph." },
    { title: "Bridging on-chain", sub: "USD card cleared. Sending USDC on Morph." },
    { title: "Off-ramping to peso", sub: "Coins.ph is swapping USDC to PHP." },
    { title: "Off-ramping to peso", sub: "InstaPay sending to GCash." },
    { title: "Done — money delivered", sub: "Seconds, end to end." },
  ];
}
