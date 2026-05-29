import { describe, expect, it } from "vitest";

import { annualRange, applyGraduatedBrackets, quarterRange, round2 } from "./tax-math";

describe("quarterRange", () => {
  it("returns UTC Q1 [Jan 1 00:00:00.000 .. Mar 31 23:59:59.999]", () => {
    const { start, end } = quarterRange(1, 2026);
    expect(start.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-03-31T23:59:59.999Z");
  });

  it("returns UTC Q2 [Apr 1 .. Jun 30 23:59:59.999]", () => {
    const { start, end } = quarterRange(2, 2026);
    expect(start.toISOString()).toBe("2026-04-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-06-30T23:59:59.999Z");
  });

  it("returns UTC Q3 [Jul 1 .. Sep 30 23:59:59.999]", () => {
    const { start, end } = quarterRange(3, 2026);
    expect(start.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-09-30T23:59:59.999Z");
  });
});

describe("annualRange", () => {
  it("returns UTC [Jan 1 00:00:00.000 .. Dec 31 23:59:59.999]", () => {
    const { start, end } = annualRange(2026);
    expect(start.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-12-31T23:59:59.999Z");
  });
});

describe("applyGraduatedBrackets", () => {
  it("returns 0 for zero income", () => {
    expect(applyGraduatedBrackets(0)).toBe(0);
  });

  it("returns 0 at the ₱250,000 boundary (still 0% bracket)", () => {
    expect(applyGraduatedBrackets(250_000)).toBe(0);
  });

  it("returns ₱22,500 at the ₱400,000 boundary", () => {
    expect(applyGraduatedBrackets(400_000)).toBe(22_500);
  });

  it("returns ₱42,500 at ₱500,000 (interior of 20% bracket)", () => {
    expect(applyGraduatedBrackets(500_000)).toBe(42_500);
  });

  it("returns ₱102,500 at the ₱800,000 boundary", () => {
    expect(applyGraduatedBrackets(800_000)).toBe(102_500);
  });

  it("returns ₱402,500 at the ₱2,000,000 boundary", () => {
    expect(applyGraduatedBrackets(2_000_000)).toBe(402_500);
  });

  it("returns ₱2,202,500 at the ₱8,000,000 boundary", () => {
    expect(applyGraduatedBrackets(8_000_000)).toBe(2_202_500);
  });

  it("returns ₱2,902,500 at ₱10,000,000 (interior of 35% top bracket)", () => {
    expect(applyGraduatedBrackets(10_000_000)).toBe(2_902_500);
  });
});

describe("round2", () => {
  it("rounds 38.984 down to 38.98", () => {
    expect(round2(38.984)).toBe(38.98);
  });

  it("rounds 38.985 up to 38.99 (half-up via Math.round)", () => {
    expect(round2(38.985)).toBe(38.99);
  });
});
