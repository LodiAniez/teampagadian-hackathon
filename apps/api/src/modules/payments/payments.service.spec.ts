import { beforeEach, describe, expect, it } from "vitest";
import { PaymentsService } from "./payments.service";

// Smoke spec for the stub. Real behaviour tests land with TEA-42 (FX +
// payment-row creation via SettlementService).
describe("PaymentsService", () => {
  let service: PaymentsService;

  beforeEach(() => {
    service = new PaymentsService();
  });

  it("handlePaymentSucceeded resolves without throwing (stub for TEA-42)", async () => {
    await expect(
      service.handlePaymentSucceeded({
        stripePaymentIntentId: "pi_test",
        stripeChargeId: "ch_test",
        amountReceived: 100,
        amountReceivedCurrency: "USD",
        invoiceId: "inv_test",
        paidAt: new Date(),
      }),
    ).resolves.toBeUndefined();
  });

  it("handleCheckoutCompleted resolves without throwing (stub for TEA-42)", async () => {
    await expect(
      service.handleCheckoutCompleted({
        stripeSessionId: "cs_test",
        stripePaymentIntentId: "pi_test",
        invoiceId: "inv_test",
      }),
    ).resolves.toBeUndefined();
  });
});
