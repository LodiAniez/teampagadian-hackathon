import { describe, expect, it } from "vitest";

import { PH_TAX_RATES } from "../ph-tax-rates";

describe("PH_TAX_RATES (TEA-58 verified constants)", () => {
  it("locks 8% election values", () => {
    expect(PH_TAX_RATES.EIGHT_PERCENT.rate).toBe(0.08);
    expect(PH_TAX_RATES.EIGHT_PERCENT.annualExemption).toBe(250_000);
    expect(PH_TAX_RATES.EIGHT_PERCENT.grossReceiptsThreshold).toBe(3_000_000);
  });

  it("locks graduated brackets (TRAIN Phase 2, 2023+)", () => {
    expect(PH_TAX_RATES.GRADUATED_BRACKETS).toEqual([
      { upTo: 250_000, rate: 0.0, baseAmount: 0 },
      { upTo: 400_000, rate: 0.15, baseAmount: 0 },
      { upTo: 800_000, rate: 0.2, baseAmount: 22_500 },
      { upTo: 2_000_000, rate: 0.25, baseAmount: 102_500 },
      { upTo: 8_000_000, rate: 0.3, baseAmount: 402_500 },
      { upTo: Number.POSITIVE_INFINITY, rate: 0.35, baseAmount: 2_202_500 },
    ]);
  });

  it("locks percentage tax rate (post-CREATE-expiration)", () => {
    expect(PH_TAX_RATES.PERCENTAGE_TAX.rate).toBe(0.03);
  });

  it("locks VAT rate + threshold", () => {
    expect(PH_TAX_RATES.VAT.rate).toBe(0.12);
    expect(PH_TAX_RATES.VAT.annualThreshold).toBe(3_000_000);
  });

  it("locks 2026 quarterly + annual deadlines", () => {
    expect(PH_TAX_RATES.DEADLINES["1701Q_Q1"]).toBe("2026-05-15");
    expect(PH_TAX_RATES.DEADLINES["1701Q_Q2"]).toBe("2026-08-15");
    expect(PH_TAX_RATES.DEADLINES["1701Q_Q3"]).toBe("2026-11-15");
    expect(PH_TAX_RATES.DEADLINES["1701_ANNUAL_2026"]).toBe("2027-04-15");
  });

  it("brackets are non-overlapping and sorted ascending", () => {
    const ups = PH_TAX_RATES.GRADUATED_BRACKETS.map((b) => b.upTo);
    const sorted = [...ups].sort((a, b) => a - b);
    expect(ups).toEqual(sorted);
  });

  it("base amounts are monotonically non-decreasing", () => {
    const bases = PH_TAX_RATES.GRADUATED_BRACKETS.map((b) => b.baseAmount);
    for (let i = 1; i < bases.length; i++) {
      expect(bases[i]).toBeGreaterThanOrEqual(bases[i - 1]);
    }
  });
});
