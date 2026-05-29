import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import { PrismaService } from "../../../common/prisma/prisma.service";
import { PH_TAX_RATES } from "../ph-tax-rates";
import { TaxCalculatorService } from "../tax-calculator.service";

const USER_ID = "f0e1d2c3-b4a5-6e7d-8c9b-0a1b2c3d4e5f";

type PaymentFixture = {
  amountPhp: Prisma.Decimal;
  paidAt: Date;
  invoice: { client: { name: string } };
};

function payment(amount: string, isoDate: string, clientName = "Acme Co."): PaymentFixture {
  return {
    amountPhp: new Prisma.Decimal(amount),
    paidAt: new Date(isoDate),
    invoice: { client: { name: clientName } },
  };
}

// Sums to ₱487,250 — the ticket's stated 8%-election reference case where
// 487,250 × 8% = ₱38,980 exactly.
const REFERENCE_8PCT_PAYMENTS = [
  payment("200000.00", "2026-01-15T03:00:00.000Z", "Acme Co."),
  payment("150000.00", "2026-02-10T05:30:00.000Z", "Globex"),
  payment("137250.00", "2026-03-20T10:00:00.000Z", "Initech"),
];

type Harness = {
  service: TaxCalculatorService;
  prisma: DeepMockProxy<PrismaService>;
};

function buildHarness(): Harness {
  const prisma = mockDeep<PrismaService>();
  const service = new TaxCalculatorService(prisma);
  return { service, prisma };
}

describe("TaxCalculatorService.computeQuarterly", () => {
  let h: Harness;
  beforeEach(() => {
    h = buildHarness();
  });

  it("8% election: ₱487,250 of settled payments in Q1 → ₱38,980 tax due (no exemption)", async () => {
    h.prisma.payment.findMany.mockResolvedValue(REFERENCE_8PCT_PAYMENTS as never);

    const result = await h.service.computeQuarterly(USER_ID, 1, 2026, "8_percent");

    expect(result.grossReceiptsPhp).toBe(487_250);
    expect(result.taxDuePhp).toBe(38_980);
    expect(result.election).toBe("8_percent");
    expect(result.breakdown).toBe("₱487,250 × 8% = ₱38,980");
  });

  it("graduated election: ₱500,000 of settled payments in Q2 → ₱42,500 tax due", async () => {
    h.prisma.payment.findMany.mockResolvedValue([
      payment("500000.00", "2026-05-01T00:00:00.000Z", "Acme Co."),
    ] as never);

    const result = await h.service.computeQuarterly(USER_ID, 2, 2026, "graduated");

    expect(result.grossReceiptsPhp).toBe(500_000);
    expect(result.taxDuePhp).toBe(42_500);
    expect(result.election).toBe("graduated");
    expect(result.breakdown).toBe("Graduated tax on ₱500,000: ₱42,500");
  });

  it("returns zeros + empty breakdown for a quarter with no settled payments", async () => {
    h.prisma.payment.findMany.mockResolvedValue([] as never);

    const result = await h.service.computeQuarterly(USER_ID, 1, 2026, "8_percent");

    expect(result.grossReceiptsPhp).toBe(0);
    expect(result.taxDuePhp).toBe(0);
    expect(result.invoiceCount).toBe(0);
    expect(result.paymentBreakdown).toEqual([]);
  });

  it("uses 1701Q form code for quarterly returns regardless of election", async () => {
    h.prisma.payment.findMany.mockResolvedValue([] as never);

    const eight = await h.service.computeQuarterly(USER_ID, 1, 2026, "8_percent");
    const graduated = await h.service.computeQuarterly(USER_ID, 1, 2026, "graduated");

    expect(eight.formCode).toBe("1701Q");
    expect(eight.formName).toBe("Quarterly Income Tax Return");
    expect(graduated.formCode).toBe("1701Q");
  });

  it("pulls the deadline from PH_TAX_RATES.DEADLINES (not a hardcoded string)", async () => {
    h.prisma.payment.findMany.mockResolvedValue([] as never);

    const q1 = await h.service.computeQuarterly(USER_ID, 1, 2026, "8_percent");
    const q2 = await h.service.computeQuarterly(USER_ID, 2, 2026, "8_percent");
    const q3 = await h.service.computeQuarterly(USER_ID, 3, 2026, "8_percent");

    expect(q1.deadline).toBe(PH_TAX_RATES.DEADLINES["1701Q_Q1"]);
    expect(q2.deadline).toBe(PH_TAX_RATES.DEADLINES["1701Q_Q2"]);
    expect(q3.deadline).toBe(PH_TAX_RATES.DEADLINES["1701Q_Q3"]);
  });

  it("filters Prisma findMany to morphTxStatus: SETTLED + userId + paidAt range (UTC)", async () => {
    h.prisma.payment.findMany.mockResolvedValue([] as never);

    await h.service.computeQuarterly(USER_ID, 1, 2026, "8_percent");

    const call = h.prisma.payment.findMany.mock.calls[0][0];
    expect(call?.where).toMatchObject({
      userId: USER_ID,
      morphTxStatus: "SETTLED",
    });
    const paidAt = (call?.where as { paidAt: { gte: Date; lte: Date } }).paidAt;
    expect(paidAt.gte.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(paidAt.lte.toISOString()).toBe("2026-03-31T23:59:59.999Z");
  });

  it("maps paymentBreakdown rows to { date: YYYY-MM-DD, client, amountPhp: number }", async () => {
    h.prisma.payment.findMany.mockResolvedValue(REFERENCE_8PCT_PAYMENTS as never);

    const result = await h.service.computeQuarterly(USER_ID, 1, 2026, "8_percent");

    expect(result.invoiceCount).toBe(3);
    expect(result.paymentBreakdown).toEqual([
      { date: "2026-01-15", client: "Acme Co.", amountPhp: 200_000 },
      { date: "2026-02-10", client: "Globex", amountPhp: 150_000 },
      { date: "2026-03-20", client: "Initech", amountPhp: 137_250 },
    ]);
  });
});

describe("TaxCalculatorService.computeAnnual", () => {
  let h: Harness;
  beforeEach(() => {
    h = buildHarness();
  });

  it("8% election: applies ₱250,000 annual exemption → (500K - 250K) × 8% = ₱20,000", async () => {
    h.prisma.payment.findMany.mockResolvedValue([
      payment("500000.00", "2026-06-01T00:00:00.000Z"),
    ] as never);

    const result = await h.service.computeAnnual(USER_ID, 2026, "8_percent");

    expect(result.grossReceiptsPhp).toBe(500_000);
    expect(result.taxDuePhp).toBe(20_000);
    expect(result.breakdown).toBe("(₱500,000 - ₱250,000) × 8% = ₱20,000");
  });

  it("graduated election: no exemption baked in by the regime — ₱500K → ₱42,500", async () => {
    h.prisma.payment.findMany.mockResolvedValue([
      payment("500000.00", "2026-06-01T00:00:00.000Z"),
    ] as never);

    const result = await h.service.computeAnnual(USER_ID, 2026, "graduated");

    expect(result.taxDuePhp).toBe(42_500);
  });

  it("uses 1701A for 8% election and 1701 for graduated, with form names", async () => {
    h.prisma.payment.findMany.mockResolvedValue([] as never);

    const eight = await h.service.computeAnnual(USER_ID, 2026, "8_percent");
    const graduated = await h.service.computeAnnual(USER_ID, 2026, "graduated");

    expect(eight.formCode).toBe("1701A");
    expect(eight.formName).toBe("Annual Income Tax Return (8% election)");
    expect(graduated.formCode).toBe("1701");
    expect(graduated.formName).toBe("Annual Income Tax Return");
  });

  it("pulls annual deadline from PH_TAX_RATES.DEADLINES['1701_ANNUAL_TY2026']", async () => {
    h.prisma.payment.findMany.mockResolvedValue([] as never);

    const result = await h.service.computeAnnual(USER_ID, 2026, "graduated");

    expect(result.deadline).toBe(PH_TAX_RATES.DEADLINES["1701_ANNUAL_TY2026"]);
  });
});
