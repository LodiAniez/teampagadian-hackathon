import { describe, expect, it } from "vitest";
import type { FxComparison } from "@raket/contracts";
import { buildFxRows } from "./fx-display";

const comparison: FxComparison = {
  usdAmount: 1000,
  phpRate: 56,
  savedVsPaypalPhp: 3304,
  providers: [
    {
      provider: "raket",
      label: "Raket",
      feePct: 1.0,
      feePhp: 560,
      receivedPhp: 55440,
      deltaVsRaketPhp: 0,
    },
    {
      provider: "paypal",
      label: "PayPal",
      feePct: 6.9,
      feePhp: 3864,
      receivedPhp: 52136,
      deltaVsRaketPhp: 3304,
    },
    {
      provider: "wise",
      label: "Wise",
      feePct: 0.65,
      feePhp: 364,
      receivedPhp: 55636,
      deltaVsRaketPhp: -196,
    },
    {
      provider: "bank",
      label: "Bank wire",
      feePct: 5.0,
      feePhp: 2800,
      receivedPhp: 53200,
      deltaVsRaketPhp: 2240,
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

  it("formats the fee as a 2-decimal percentage", () => {
    const rows = buildFxRows(comparison);
    expect(rows.find((r) => r.provider === "wise")?.feePctLabel).toBe("0.65%");
    expect(rows.find((r) => r.provider === "bank")?.feePctLabel).toBe("5.00%");
  });

  it("formats receivedPhp as PHP currency", () => {
    const raket = buildFxRows(comparison).find((r) => r.provider === "raket");
    expect(raket?.receivedLabel).toContain("₱");
    expect(raket?.receivedLabel).toContain("55,440");
  });

  it("shows no vs-Raket delta on the Raket row itself", () => {
    const raket = buildFxRows(comparison).find((r) => r.provider === "raket");
    expect(raket?.vsRaketLabel).toBeNull();
  });

  it("shows a loss vs Raket when the provider nets less (positive delta)", () => {
    const paypal = buildFxRows(comparison).find((r) => r.provider === "paypal");
    expect(paypal?.vsRaketLabel).toContain("−");
    expect(paypal?.vsRaketLabel).toContain("3,304");
    expect(paypal?.vsRaketLabel).toContain("vs Raket");
  });

  it("shows a gain vs Raket when the provider nets more (negative delta, e.g. Wise)", () => {
    const wise = buildFxRows(comparison).find((r) => r.provider === "wise");
    expect(wise?.vsRaketLabel).toContain("+");
    expect(wise?.vsRaketLabel).toContain("196");
  });
});
