import { describe, expect, it } from "vitest";
import type { FxComparison } from "@raket/contracts";
import { buildFxRows } from "./fx-display";

const comparison: FxComparison = {
  usdAmount: 1000,
  phpRate: 56,
  savedVsPaypalPhp: 3584,
  providers: [
    {
      provider: "raket",
      label: "Raket",
      feePct: 0.5,
      feePhp: 280,
      receivedPhp: 55720,
      deltaVsRaketPhp: 0,
    },
    {
      provider: "paypal",
      label: "PayPal",
      feePct: 6.9,
      feePhp: 3864,
      receivedPhp: 52136,
      deltaVsRaketPhp: 3584,
    },
    {
      provider: "wise",
      label: "Wise",
      feePct: 0.65,
      feePhp: 364,
      receivedPhp: 55636,
      deltaVsRaketPhp: 84,
    },
    {
      provider: "bank",
      label: "Bank wire",
      feePct: 5.0,
      feePhp: 2800,
      receivedPhp: 53200,
      deltaVsRaketPhp: 2520,
    },
  ],
};

describe("buildFxRows", () => {
  it("returns one display row per provider, in order", () => {
    const rows = buildFxRows(comparison);
    expect(rows.map((r) => r.provider)).toEqual(["raket", "paypal", "wise", "bank"]);
  });

  it("highlights only the Raket row", () => {
    const rows = buildFxRows(comparison);
    expect(rows.find((r) => r.provider === "raket")?.highlighted).toBe(true);
    expect(rows.filter((r) => r.highlighted)).toHaveLength(1);
  });

  it("flags exactly one row as the best rate, on the highest-receivedPhp provider (Raket)", () => {
    const rows = buildFxRows(comparison);
    expect(rows.filter((r) => r.isBest)).toHaveLength(1);
    expect(rows.find((r) => r.isBest)?.provider).toBe("raket");
  });

  it("resolves a best-rate tie to Raket", () => {
    const tied: FxComparison = {
      ...comparison,
      providers: comparison.providers.map((p) =>
        p.provider === "wise" ? { ...p, receivedPhp: 55720 } : p,
      ),
    };
    const best = buildFxRows(tied).filter((r) => r.isBest);
    expect(best).toHaveLength(1);
    expect(best[0].provider).toBe("raket");
  });

  it("formats the fee as a 2-decimal percentage", () => {
    const rows = buildFxRows(comparison);
    expect(rows.find((r) => r.provider === "wise")?.feePctLabel).toBe("0.65%");
    expect(rows.find((r) => r.provider === "bank")?.feePctLabel).toBe("5.00%");
  });

  it("formats receivedPhp as PHP currency", () => {
    const raket = buildFxRows(comparison).find((r) => r.provider === "raket");
    expect(raket?.receivedLabel).toContain("₱");
    expect(raket?.receivedLabel).toContain("55,720");
  });

  it("shows no vs-Raket delta on the Raket row itself", () => {
    const raket = buildFxRows(comparison).find((r) => r.provider === "raket");
    expect(raket?.vsRaketLabel).toBeNull();
  });

  it("shows a loss vs Raket when the provider nets less (positive delta)", () => {
    const paypal = buildFxRows(comparison).find((r) => r.provider === "paypal");
    expect(paypal?.vsRaketLabel).toContain("−");
    expect(paypal?.vsRaketLabel).toContain("3,584");
    expect(paypal?.vsRaketLabel).toContain("vs Raket");
  });

  it("shows a loss vs Raket for Wise too, now that Raket (0.5%) undercuts it", () => {
    const wise = buildFxRows(comparison).find((r) => r.provider === "wise");
    expect(wise?.vsRaketLabel).toContain("−");
    expect(wise?.vsRaketLabel).toContain("84");
    expect(wise?.vsRaketLabel).toContain("vs Raket");
  });
});
