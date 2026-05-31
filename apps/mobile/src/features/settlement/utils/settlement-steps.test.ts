import { describe, expect, it } from "vitest";
import { buildSettlementHero, buildSettlementSteps } from "./settlement-steps";
import { SETTLEMENT_STEP_COUNT } from "../constants";
import type { PayoutLandedEvent } from "../types";

const baseEvent: PayoutLandedEvent = {
  payoutId: "p1",
  amountPhp: 83685,
  amountUsd: 1600,
  clientName: "Acme Northwind",
  fxRate: 55.85,
  gcashLast4: "1234",
};

describe("buildSettlementSteps", () => {
  it("returns exactly SETTLEMENT_STEP_COUNT steps", () => {
    expect(buildSettlementSteps(baseEvent)).toHaveLength(SETTLEMENT_STEP_COUNT);
  });

  it("templates the USD amount and client name into the first (Stripe) step", () => {
    const [stripe] = buildSettlementSteps(baseEvent);
    expect(stripe.title).toMatch(/stripe/i);
    expect(stripe.meta).toContain("$1,600.00");
    expect(stripe.meta).toContain("Acme Northwind");
  });

  it("templates the PHP amount into the final (GCash) step", () => {
    const steps = buildSettlementSteps(baseEvent);
    const delivered = steps[steps.length - 1];
    expect(delivered.title).toMatch(/gcash/i);
    expect(delivered.meta).toContain("₱83,685.00");
  });

  it("falls back to demo defaults when optional fields are missing", () => {
    const steps = buildSettlementSteps({ payoutId: "p2", amountPhp: 50000 });
    expect(steps[0].meta).toContain("$1,600.00");
    expect(steps[steps.length - 1].meta).toContain("₱50,000.00");
  });
});

describe("buildSettlementHero", () => {
  it("returns one hero per step", () => {
    expect(buildSettlementHero()).toHaveLength(SETTLEMENT_STEP_COUNT);
  });

  it("opens with the settling copy and ends with the delivered copy", () => {
    const heroes = buildSettlementHero();
    expect(heroes[0].title).toMatch(/settling/i);
    expect(heroes[heroes.length - 1].title).toMatch(/delivered|done/i);
  });
});
