import { Logger } from "@nestjs/common";
import {
  Prisma,
  PayoutMethodType,
  PayoutStatus,
  type Payment,
  type Payout,
  type PayoutMethod,
} from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import { PrismaService } from "../../common/prisma/prisma.service";
import { PayoutsService } from "./payouts.service";

const PAYMENT_ID = "payment-1";
const USER_ID = "user-1";
const METHOD_ID = "pm-1";
const AMOUNT = new Prisma.Decimal("1234.56");
const NOW = new Date("2026-05-29T00:00:00Z");

function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: PAYMENT_ID,
    invoiceId: "invoice-1",
    userId: USER_ID,
    stripePaymentIntentId: "pi_test_123",
    stripeChargeId: "ch_test_123",
    amountReceived: new Prisma.Decimal("22.50"),
    amountReceivedCurrency: "USD",
    amountPhp: AMOUNT,
    fxRate: new Prisma.Decimal("55.000000"),
    fxFeeAmount: new Prisma.Decimal("0.00"),
    fxFeePercent: new Prisma.Decimal("0.0000"),
    stripeFeeAmount: null,
    morphTxHash: null,
    morphTxStatus: "SETTLED",
    morphRetryCount: 0,
    morphAnchorBlock: null,
    paidAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makePayoutMethod(overrides: Partial<PayoutMethod> = {}): PayoutMethod {
  return {
    id: METHOD_ID,
    userId: USER_ID,
    type: PayoutMethodType.GCASH,
    details: { phoneNumber: "+639171234567", accountName: "Juan" },
    isDefault: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makePayout(overrides: Partial<Payout> = {}): Payout {
  return {
    id: "payout-1",
    paymentId: PAYMENT_ID,
    payoutMethodId: METHOD_ID,
    amountPhp: AMOUNT,
    status: PayoutStatus.DELIVERED,
    externalTxnId: "GC-1-AAAAAAAA",
    completedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

// Runs the service with fake timers advanced past the simulated 1–2 s delay.
// The mocked Math.random branch can push the delay up to 1000 + ~1000 = ~2000 ms,
// so 2100 ms covers it with margin without ever actually sleeping.
async function runWithAdvancedTimers<T>(promise: Promise<T>): Promise<T> {
  await vi.advanceTimersByTimeAsync(2100);
  return promise;
}

describe("PayoutsService.disburseToFreelancer", () => {
  let service: PayoutsService;
  let prisma: DeepMockProxy<PrismaService>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
    prisma = mockDeep<PrismaService>();
    warnSpy = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    service = new PayoutsService(prisma);
  });

  afterEach(() => {
    vi.useRealTimers();
    warnSpy.mockRestore();
  });

  it("creates a DELIVERED payout row linked to the payment with mock txn id and completedAt set", async () => {
    const payment = makePayment();
    const method = makePayoutMethod({ type: PayoutMethodType.GCASH });
    const created = makePayout({ status: PayoutStatus.DELIVERED });

    prisma.payment.findUniqueOrThrow.mockResolvedValue(payment);
    prisma.payoutMethod.findFirst.mockResolvedValue(method);
    prisma.payout.create.mockResolvedValue(created);

    const result = await runWithAdvancedTimers(service.disburseToFreelancer(PAYMENT_ID));

    expect(result).toBe(created);
    expect(prisma.payment.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: PAYMENT_ID },
    });
    expect(prisma.payoutMethod.findFirst).toHaveBeenCalledWith({
      where: { userId: USER_ID, isDefault: true },
    });
    expect(prisma.payout.create).toHaveBeenCalledTimes(1);
    const createArg = prisma.payout.create.mock.calls[0][0];
    expect(createArg.data).toMatchObject({
      paymentId: PAYMENT_ID,
      payoutMethodId: METHOD_ID,
      amountPhp: AMOUNT,
      status: PayoutStatus.DELIVERED,
    });
    expect(createArg.data.completedAt).toBeInstanceOf(Date);
    expect(typeof createArg.data.externalTxnId).toBe("string");
    expect((createArg.data.externalTxnId as string).length).toBeGreaterThan(0);
  });

  it.each<[PayoutMethodType, string]>([
    [PayoutMethodType.CARD, "CARD-PAYOUT-"],
    [PayoutMethodType.GCASH, "GC-"],
    [PayoutMethodType.MAYA, "MY-"],
    [PayoutMethodType.BANK_ACCOUNT, "BNK-"],
  ])("generates a mock txn id with the right prefix for %s", async (type, prefix) => {
    prisma.payment.findUniqueOrThrow.mockResolvedValue(makePayment());
    prisma.payoutMethod.findFirst.mockResolvedValue(makePayoutMethod({ type }));
    prisma.payout.create.mockResolvedValue(makePayout());

    await runWithAdvancedTimers(service.disburseToFreelancer(PAYMENT_ID));

    const createArg = prisma.payout.create.mock.calls[0][0];
    expect(createArg.data.externalTxnId).toMatch(new RegExp(`^${prefix}`));
  });

  it("returns null and warns when the user has no default payout method; does not create", async () => {
    prisma.payment.findUniqueOrThrow.mockResolvedValue(makePayment());
    prisma.payoutMethod.findFirst.mockResolvedValue(null);

    const result = await service.disburseToFreelancer(PAYMENT_ID);

    expect(result).toBeNull();
    expect(prisma.payout.create).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain(USER_ID);
  });

  it("returns the existing row on P2002 (idempotent duplicate webhook); never throws", async () => {
    const existing = makePayout({ status: PayoutStatus.DELIVERED });
    prisma.payment.findUniqueOrThrow.mockResolvedValue(makePayment());
    prisma.payoutMethod.findFirst.mockResolvedValue(makePayoutMethod());
    prisma.payout.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );
    prisma.payout.findUniqueOrThrow.mockResolvedValue(existing);

    const result = await runWithAdvancedTimers(service.disburseToFreelancer(PAYMENT_ID));

    expect(result).toBe(existing);
    expect(prisma.payout.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { paymentId: PAYMENT_ID },
    });
  });

  it("propagates non-P2002 Prisma errors so genuine bugs aren't masked", async () => {
    const err = new Prisma.PrismaClientKnownRequestError("Foreign key violation", {
      code: "P2003",
      clientVersion: "test",
    });
    prisma.payment.findUniqueOrThrow.mockResolvedValue(makePayment());
    prisma.payoutMethod.findFirst.mockResolvedValue(makePayoutMethod());
    prisma.payout.create.mockRejectedValue(err);

    const promise = service.disburseToFreelancer(PAYMENT_ID);
    const settled = promise.catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(2100);
    const caught = await settled;

    expect(caught).toBe(err);
    expect(prisma.payout.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it("simulates a 1–2 s disbursement delay via setTimeout without actually sleeping", async () => {
    prisma.payment.findUniqueOrThrow.mockResolvedValue(makePayment());
    prisma.payoutMethod.findFirst.mockResolvedValue(makePayoutMethod());
    prisma.payout.create.mockResolvedValue(makePayout());

    const setTimeoutSpy = vi.spyOn(global, "setTimeout");

    const promise = service.disburseToFreelancer(PAYMENT_ID);
    // Before advancing, nothing has resolved — the service is parked in setTimeout.
    // Advance past the max possible delay (1000 + ~1000 ms) and verify completion.
    await vi.advanceTimersByTimeAsync(2100);
    await promise;

    const delayCalls = setTimeoutSpy.mock.calls.filter(([, delay]) => {
      return typeof delay === "number" && delay >= 1000 && delay <= 2000;
    });
    expect(delayCalls.length).toBeGreaterThanOrEqual(1);

    setTimeoutSpy.mockRestore();
  });
});
