import { Prisma, type Invoice } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import { PrismaService } from "../../common/prisma/prisma.service";
import { StripeService } from "../integrations/stripe/stripe.service";
import { PaymentIntentPoller } from "./payment-intent-poller";
import { PaymentsService } from "./payments.service";
import type { PaymentSucceededEvent } from "./payments.types";

const PAID_AT = new Date("2026-05-29T00:00:00Z");

function makeEvent(overrides: Partial<PaymentSucceededEvent> = {}): PaymentSucceededEvent {
  return {
    stripePaymentIntentId: "pi_1",
    stripeChargeId: "ch_1",
    amountReceived: 100,
    amountReceivedCurrency: "USD",
    invoiceId: "invoice-1",
    paidAt: PAID_AT,
    ...overrides,
  };
}

function makeInvoiceRow(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "invoice-1",
    userId: "user-1",
    clientId: "client-1",
    number: "INV-2026-0001",
    status: "sent",
    amount: new Prisma.Decimal("100.00"),
    currency: "USD",
    issueDate: new Date("2026-05-29"),
    dueDate: new Date("2026-06-29"),
    sourceType: "text",
    sourceFileUrl: null,
    stripePaymentIntentId: "pi_1",
    stripeCheckoutSessionId: "cs_1",
    stripeCheckoutUrl: null,
    publicShareToken: null,
    qrCodeDataUrl: null,
    sentAt: PAID_AT,
    createdAt: PAID_AT,
    updatedAt: PAID_AT,
    ...overrides,
  };
}

describe("PaymentIntentPoller", () => {
  let prisma: DeepMockProxy<PrismaService>;
  let stripe: DeepMockProxy<StripeService>;
  let payments: DeepMockProxy<PaymentsService>;
  let poller: PaymentIntentPoller;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    stripe = mockDeep<StripeService>();
    payments = mockDeep<PaymentsService>();
    poller = new PaymentIntentPoller(prisma, stripe, payments);
  });

  it("queries sent invoices with a PI, updated within the 5-minute window", async () => {
    prisma.invoice.findMany.mockResolvedValue([]);
    const before = Date.now();

    await poller.pollOnce();

    const after = Date.now();
    expect(prisma.invoice.findMany).toHaveBeenCalledTimes(1);
    const args = prisma.invoice.findMany.mock.calls[0][0];
    expect(args).toBeDefined();
    expect(args?.where).toEqual({
      status: "sent",
      stripePaymentIntentId: { not: null },
      updatedAt: { gte: expect.any(Date) },
    });
    expect(args?.select).toEqual({ id: true, stripePaymentIntentId: true });

    const updatedAtFilter = args?.where?.updatedAt;
    if (
      !updatedAtFilter ||
      typeof updatedAtFilter !== "object" ||
      !("gte" in updatedAtFilter) ||
      !(updatedAtFilter.gte instanceof Date)
    ) {
      throw new Error("expected updatedAt filter to be { gte: Date }");
    }
    const gteMs = updatedAtFilter.gte.getTime();
    const fiveMin = 5 * 60 * 1000;
    expect(gteMs).toBeGreaterThanOrEqual(before - fiveMin - 1000);
    expect(gteMs).toBeLessThanOrEqual(after - fiveMin + 1000);
  });

  it("does nothing when no candidates are returned", async () => {
    prisma.invoice.findMany.mockResolvedValue([]);

    await poller.pollOnce();

    expect(stripe.tryGetPaymentSucceededEvent).not.toHaveBeenCalled();
    expect(payments.handlePaymentSucceeded).not.toHaveBeenCalled();
  });

  it("forwards the mapped event to handlePaymentSucceeded and logs path=poll on success", async () => {
    prisma.invoice.findMany.mockResolvedValue([
      makeInvoiceRow({ id: "invoice-1", stripePaymentIntentId: "pi_1" }),
    ]);
    const event = makeEvent();
    stripe.tryGetPaymentSucceededEvent.mockResolvedValue(event);
    const logSpy = vi.spyOn(poller["logger"], "log").mockImplementation(() => undefined);

    await poller.pollOnce();

    expect(stripe.tryGetPaymentSucceededEvent).toHaveBeenCalledWith("pi_1");
    expect(payments.handlePaymentSucceeded).toHaveBeenCalledTimes(1);
    expect(payments.handlePaymentSucceeded).toHaveBeenCalledWith(event);
    expect(logSpy).toHaveBeenCalledTimes(1);
    const logged = String(logSpy.mock.calls[0][0]);
    expect(logged).toContain("path=poll");
    expect(logged).toContain("invoiceId=invoice-1");
    expect(logged).toContain("piId=pi_1");
  });

  it("does not call handlePaymentSucceeded when the PI is not yet succeeded", async () => {
    prisma.invoice.findMany.mockResolvedValue([
      makeInvoiceRow({ id: "invoice-1", stripePaymentIntentId: "pi_1" }),
    ]);
    stripe.tryGetPaymentSucceededEvent.mockResolvedValue(null);

    await poller.pollOnce();

    expect(stripe.tryGetPaymentSucceededEvent).toHaveBeenCalledWith("pi_1");
    expect(payments.handlePaymentSucceeded).not.toHaveBeenCalled();
  });

  it("isolates per-invoice failures so a later candidate still processes", async () => {
    prisma.invoice.findMany.mockResolvedValue([
      makeInvoiceRow({ id: "invoice-1", stripePaymentIntentId: "pi_1" }),
      makeInvoiceRow({ id: "invoice-2", stripePaymentIntentId: "pi_2" }),
    ]);
    stripe.tryGetPaymentSucceededEvent.mockImplementation(async (piId) => {
      if (piId === "pi_1") throw new Error("network blip");
      return makeEvent({ invoiceId: "invoice-2", stripePaymentIntentId: "pi_2" });
    });
    const errorSpy = vi.spyOn(poller["logger"], "error").mockImplementation(() => undefined);

    await poller.pollOnce();

    expect(stripe.tryGetPaymentSucceededEvent).toHaveBeenCalledTimes(2);
    expect(payments.handlePaymentSucceeded).toHaveBeenCalledTimes(1);
    expect(payments.handlePaymentSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({ invoiceId: "invoice-2", stripePaymentIntentId: "pi_2" }),
    );
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const errLog = String(errorSpy.mock.calls[0][0]);
    expect(errLog).toContain("invoice-1");
    expect(errLog).toContain("path=poll");
  });

  it("runScheduled swallows pollOnce errors and logs them with path=poll", async () => {
    prisma.invoice.findMany.mockRejectedValue(new Error("db down"));
    const errorSpy = vi.spyOn(poller["logger"], "error").mockImplementation(() => undefined);

    await expect(poller.runScheduled()).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const errLog = String(errorSpy.mock.calls[0][0]);
    expect(errLog).toContain("path=poll");
    expect(errLog).toContain("db down");
  });
});
