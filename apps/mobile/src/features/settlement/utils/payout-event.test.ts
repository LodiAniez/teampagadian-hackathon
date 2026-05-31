import { describe, expect, it } from "vitest";
import { parsePayoutInsert } from "./payout-event";

describe("parsePayoutInsert", () => {
  it("maps a well-formed payouts row to a landed event", () => {
    // Postgres NUMERIC columns arrive over realtime as strings.
    const event = parsePayoutInsert({ id: "abc-123", amount_php: "83685.00", status: "COMPLETED" });
    expect(event).toEqual({ payoutId: "abc-123", amountPhp: 83685 });
  });

  it("accepts a numeric amount_php as well", () => {
    expect(parsePayoutInsert({ id: "abc-123", amount_php: 50000 })?.amountPhp).toBe(50000);
  });

  it("returns null for a row missing the id", () => {
    expect(parsePayoutInsert({ amount_php: "100" })).toBeNull();
  });

  it("returns null for a non-numeric amount", () => {
    expect(parsePayoutInsert({ id: "abc-123", amount_php: "not-a-number" })).toBeNull();
  });

  it("returns null for a non-object payload", () => {
    expect(parsePayoutInsert(null)).toBeNull();
    expect(parsePayoutInsert("nope")).toBeNull();
  });
});
