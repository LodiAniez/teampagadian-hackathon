import { describe, expect, it } from "vitest";
import { parseSettlementParams } from "./route-params";

describe("parseSettlementParams", () => {
  it("parses payoutId, amountPhp and optional clientName from string params", () => {
    expect(
      parseSettlementParams({ payoutId: "p1", amountPhp: "83685", clientName: "Acme" }),
    ).toEqual({ payoutId: "p1", amountPhp: 83685, clientName: "Acme" });
  });

  it("omits clientName when absent", () => {
    expect(parseSettlementParams({ payoutId: "p1", amountPhp: "100" })).toEqual({
      payoutId: "p1",
      amountPhp: 100,
    });
  });

  it("falls back to a synthetic id and zero amount when params are malformed", () => {
    const event = parseSettlementParams({});
    expect(event.amountPhp).toBe(0);
    expect(event.payoutId).toMatch(/^unknown/);
  });

  it("takes the first value when Expo Router passes an array param", () => {
    expect(parseSettlementParams({ payoutId: ["p1", "p2"], amountPhp: ["100"] }).payoutId).toBe(
      "p1",
    );
  });
});
