import { describe, expect, it } from "vitest";
import { buildLandedToast } from "./build-toast";

describe("buildLandedToast", () => {
  it("formats '₱<amount> received from <client>' per the ticket", () => {
    expect(
      buildLandedToast({ payoutId: "p1", amountPhp: 83685, clientName: "Acme Northwind" }),
    ).toBe("₱83,685.00 received from Acme Northwind");
  });

  it("degrades to a generic sender when the client name is unknown", () => {
    // The realtime `payouts` row carries no client name, so this is the live path.
    expect(buildLandedToast({ payoutId: "p1", amountPhp: 50000 })).toBe(
      "₱50,000.00 received from your client",
    );
  });
});
