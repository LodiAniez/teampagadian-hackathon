import { Prisma, type Payment } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import { FxRateService } from "../integrations/fx/fx-rate.service";
import { PayoutsService } from "../payouts/payouts.service";
import { SettlementService } from "../settlement/settlement.service";
import { SettlementFailedError } from "../settlement/settlement.types";
import { PaymentsService } from "./payments.service";
import type { PaymentSucceededEvent } from "./payments.types";

const PAYMENT_ID = "payment-1";
const PI_ID = "pi_test_123";
const INVOICE_ID = "invoice-1";
const USER_ID = "user-1";
const PAID_AT = new Date("2026-05-29T00:00:00Z");
const FX_RATE = 56.5;

function makeEvent(overrides: Partial<PaymentSucceededEvent> = {}): PaymentSucceededEvent {
  return {
    stripePaymentIntentId: PI_ID,
    stripeChargeId: "ch_test_123",
    amountReceived: 100,
    amountReceivedCurrency: "USD",
    invoiceId: INVOICE_ID,
    paidAt: PAID_AT,
    ...overrides,
  };
}

function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: PAYMENT_ID,
    invoiceId: INVOICE_ID,
    userId: USER_ID,
    stripePaymentIntentId: PI_ID,
    stripeChargeId: "ch_test_123",
    amountReceived: new Prisma.Decimal("100.00"),
    amountReceivedCurrency: "USD",
    amountPhp: new Prisma.Decimal("5593.50"),
    fxRate: new Prisma.Decimal("56.500000"),
    fxFeeAmount: new Prisma.Decimal("56.50"),
    fxFeePercent: new Prisma.Decimal("0.0100"),
    stripeFeeAmount: null,
    morphTxHash: "0xabc",
    morphTxStatus: "SETTLED",
    morphRetryCount: 1,
    morphAnchorBlock: null,
    paidAt: PAID_AT,
    createdAt: PAID_AT,
    updatedAt: PAID_AT,
    ...overrides,
  };
}

describe("PaymentsService.handlePaymentSucceeded", () => {
  let fxRateService: DeepMockProxy<FxRateService>;
  let settlementService: DeepMockProxy<SettlementService>;
  let payoutsService: DeepMockProxy<PayoutsService>;
  let service: PaymentsService;

  beforeEach(() => {
    fxRateService = mockDeep<FxRateService>();
    settlementService = mockDeep<SettlementService>();
    payoutsService = mockDeep<PayoutsService>();
    fxRateService.getRate.mockResolvedValue(FX_RATE);
    settlementService.settle.mockResolvedValue(makePayment());
    payoutsService.disburseToFreelancer.mockResolvedValue(null);
    service = new PaymentsService(fxRateService, settlementService, payoutsService);
  });

  it("computes FX from event currency to PHP and forwards matching args to settle()", async () => {
    await service.handlePaymentSucceeded(makeEvent({ amountReceived: 100 }));

    expect(fxRateService.getRate).toHaveBeenCalledWith("USD", "PHP");
    expect(settlementService.settle).toHaveBeenCalledTimes(1);

    const args = settlementService.settle.mock.calls[0][0];
    expect(args.fxRate).toBe(FX_RATE);
    // 100 * 56.50 = 5650 → fee 56.50 → amountPhp 5593.50
    expect(args.fxFeeAmount).toBe(56.5);
    expect(args.amountPhp).toBe(5593.5);

    const reconstructedGross = args.amountPhp + args.fxFeeAmount;
    const expectedGross = 100 * FX_RATE;
    expect(Math.abs(reconstructedGross - expectedGross)).toBeLessThanOrEqual(0.01);
  });

  it("forwards event.amountReceived to settle() UNCHANGED (regression guard against /100 cents bug)", async () => {
    await service.handlePaymentSucceeded(makeEvent({ amountReceived: 250.75 }));

    expect(settlementService.settle).toHaveBeenCalledWith(
      expect.objectContaining({ amountReceived: 250.75 }),
    );
  });

  it("calls disburseToFreelancer with payment.id when morphTxStatus is SETTLED", async () => {
    settlementService.settle.mockResolvedValue(
      makePayment({ id: "payment-settled", morphTxStatus: "SETTLED" }),
    );

    await service.handlePaymentSucceeded(makeEvent());

    expect(payoutsService.disburseToFreelancer).toHaveBeenCalledTimes(1);
    expect(payoutsService.disburseToFreelancer).toHaveBeenCalledWith("payment-settled");
  });

  it("does not call disburseToFreelancer when morphTxStatus is SETTLING", async () => {
    settlementService.settle.mockResolvedValue(
      makePayment({ morphTxStatus: "SETTLING", morphTxHash: null }),
    );

    await service.handlePaymentSucceeded(makeEvent());

    expect(payoutsService.disburseToFreelancer).not.toHaveBeenCalled();
  });

  it("swallows SettlementFailedError, logs it, and does NOT call disburseToFreelancer", async () => {
    const failure = new SettlementFailedError(PAYMENT_ID);
    settlementService.settle.mockRejectedValue(failure);
    const errorSpy = vi.spyOn(service["logger"], "error").mockImplementation(() => undefined);

    await expect(service.handlePaymentSucceeded(makeEvent())).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(payoutsService.disburseToFreelancer).not.toHaveBeenCalled();
  });

  it("rethrows non-SettlementFailedError errors from settle() unchanged", async () => {
    const transient = new Error("RPC timeout");
    settlementService.settle.mockRejectedValue(transient);

    await expect(service.handlePaymentSucceeded(makeEvent())).rejects.toBe(transient);
    expect(payoutsService.disburseToFreelancer).not.toHaveBeenCalled();
  });

  it("passes fxFeePercent = 0.01 (the constant) to settle()", async () => {
    await service.handlePaymentSucceeded(makeEvent());

    expect(settlementService.settle).toHaveBeenCalledWith(
      expect.objectContaining({ fxFeePercent: 0.01 }),
    );
  });
});
