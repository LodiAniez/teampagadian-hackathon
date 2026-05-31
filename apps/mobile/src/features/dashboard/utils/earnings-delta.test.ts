import { describe, expect, it } from "vitest";
import { computeMonthOverMonthDelta } from "./earnings-delta";

const m = (month: string, amountPhp: number) => ({ month, amountPhp, invoiceCount: 0 });

describe("computeMonthOverMonthDelta", () => {
  it("returns null with fewer than two months (can't compare)", () => {
    expect(computeMonthOverMonthDelta([])).toBeNull();
    expect(computeMonthOverMonthDelta([m("2026-05", 1000)])).toBeNull();
  });

  it("computes a positive delta and percentage from the two latest months", () => {
    const result = computeMonthOverMonthDelta([m("2026-04", 1000), m("2026-05", 1500)]);
    expect(result).toEqual({ deltaPhp: 500, deltaPct: 50, direction: "up" });
  });

  it("computes a negative delta", () => {
    const result = computeMonthOverMonthDelta([m("2026-04", 2000), m("2026-05", 1500)]);
    expect(result).toEqual({ deltaPhp: -500, deltaPct: -25, direction: "down" });
  });

  it("reports a flat month as a zero delta", () => {
    const result = computeMonthOverMonthDelta([m("2026-04", 1000), m("2026-05", 1000)]);
    expect(result).toEqual({ deltaPhp: 0, deltaPct: 0, direction: "flat" });
  });

  it("returns a null percentage when the prior month earned nothing (no base)", () => {
    const result = computeMonthOverMonthDelta([m("2026-04", 0), m("2026-05", 1200)]);
    expect(result).toEqual({ deltaPhp: 1200, deltaPct: null, direction: "up" });
  });

  it("uses the two most recent months regardless of input ordering", () => {
    const result = computeMonthOverMonthDelta([
      m("2026-05", 1500),
      m("2026-01", 100),
      m("2026-04", 1000),
    ]);
    expect(result).toEqual({ deltaPhp: 500, deltaPct: 50, direction: "up" });
  });
});
