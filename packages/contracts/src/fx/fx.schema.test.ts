import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  FX_PROVIDERS,
  FxComparisonSchema,
  FxCompareQuerySchema,
  FxProviderComparisonSchema,
} from "./fx.schema";

const validProviderRow = {
  provider: "raket",
  label: "Raket",
  feePct: 1.0,
  feePhp: 560,
  receivedPhp: 55440,
  deltaVsRaketPhp: 0,
} satisfies z.input<typeof FxProviderComparisonSchema>;

const validComparison = {
  usdAmount: 1000,
  phpRate: 56.0,
  providers: [
    validProviderRow,
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
  savedVsPaypalPhp: 3304,
} satisfies z.input<typeof FxComparisonSchema>;

describe("FX_PROVIDERS", () => {
  it("lists the four providers in display order", () => {
    expect(FX_PROVIDERS).toEqual(["raket", "paypal", "wise", "bank"]);
  });
});

describe("FxProviderComparisonSchema", () => {
  it("parses a fully populated provider row", () => {
    expect(() => FxProviderComparisonSchema.parse(validProviderRow)).not.toThrow();
  });

  it("rejects an unknown provider", () => {
    expect(() =>
      FxProviderComparisonSchema.parse({ ...validProviderRow, provider: "revolut" }),
    ).toThrow();
  });

  it("rejects a negative feePct", () => {
    expect(() => FxProviderComparisonSchema.parse({ ...validProviderRow, feePct: -1 })).toThrow();
  });

  it("rejects a negative receivedPhp", () => {
    expect(() =>
      FxProviderComparisonSchema.parse({ ...validProviderRow, receivedPhp: -1 }),
    ).toThrow();
  });

  it("allows a negative deltaVsRaketPhp (worse-than-Raket providers)", () => {
    expect(() =>
      FxProviderComparisonSchema.parse({ ...validProviderRow, deltaVsRaketPhp: -3304 }),
    ).not.toThrow();
  });
});

describe("FxComparisonSchema", () => {
  it("parses a full comparison payload", () => {
    expect(() => FxComparisonSchema.parse(validComparison)).not.toThrow();
  });

  it("rejects a non-positive usdAmount", () => {
    expect(() => FxComparisonSchema.parse({ ...validComparison, usdAmount: 0 })).toThrow();
  });

  it("rejects a non-positive phpRate", () => {
    expect(() => FxComparisonSchema.parse({ ...validComparison, phpRate: 0 })).toThrow();
  });

  it("rejects a negative savedVsPaypalPhp", () => {
    expect(() => FxComparisonSchema.parse({ ...validComparison, savedVsPaypalPhp: -1 })).toThrow();
  });
});

describe("FxCompareQuerySchema", () => {
  it("coerces a string usd query param to a number", () => {
    expect(FxCompareQuerySchema.parse({ usd: "1000" })).toEqual({ usd: 1000 });
  });

  it("rejects a non-positive usd amount", () => {
    expect(() => FxCompareQuerySchema.parse({ usd: "0" })).toThrow();
  });

  it("rejects a usd amount over the 1,000,000 cap", () => {
    expect(() => FxCompareQuerySchema.parse({ usd: "1000001" })).toThrow();
  });
});
