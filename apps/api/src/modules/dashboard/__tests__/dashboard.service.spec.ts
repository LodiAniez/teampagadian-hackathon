import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import { PrismaService } from "../../../common/prisma/prisma.service";
import { DashboardService } from "../dashboard.service";

const USER_ID = "f0e1d2c3-b4a5-6e7d-8c9b-0a1b2c3d4e5f";

type Harness = {
  service: DashboardService;
  prisma: DeepMockProxy<PrismaService>;
};

function buildHarness(): Harness {
  const prisma = mockDeep<PrismaService>();
  const service = new DashboardService(prisma);
  return { service, prisma };
}

// Stub the four parallel queries in getSummary with empty values. Tests that
// only care about *how* getSummary called Prisma use this so each assertion
// targets one dimension (filter shape, userId, query parameterization).
function stubEmptySummary(h: Harness): void {
  h.prisma.payment.aggregate
    .mockResolvedValueOnce({ _sum: { amountPhp: null } } as never)
    .mockResolvedValueOnce({ _sum: { amountPhp: null }, _count: 0 } as never);
  h.prisma.invoice.aggregate.mockResolvedValueOnce({
    _sum: { amount: null },
    _count: 0,
  } as never);
  h.prisma.$queryRaw.mockResolvedValueOnce([{ savings: 0 }]);
}

describe("DashboardService", () => {
  let h: Harness;

  beforeEach(() => {
    h = buildHarness();
  });

  describe("getSummary", () => {
    it("returns zeros for a user with no payments or pending invoices", async () => {
      stubEmptySummary(h);

      const result = await h.service.getSummary(USER_ID);

      expect(result).toEqual({
        totalEarnedPhp: 0,
        thisMonthPhp: 0,
        pendingInvoicesPhp: 0,
        pendingInvoicesCount: 0,
        invoiceCountThisMonth: 0,
        savingsVsPaypalPhp: 0,
      });
    });

    it("decodes Decimal aggregates and counts into numbers", async () => {
      h.prisma.payment.aggregate
        .mockResolvedValueOnce({
          _sum: { amountPhp: new Prisma.Decimal("12345.67") },
        } as never)
        .mockResolvedValueOnce({
          _sum: { amountPhp: new Prisma.Decimal("2000.00") },
          _count: 3,
        } as never);
      h.prisma.invoice.aggregate.mockResolvedValueOnce({
        _sum: { amount: new Prisma.Decimal("9999.99") },
        _count: 5,
      } as never);
      h.prisma.$queryRaw.mockResolvedValueOnce([{ savings: 543.21 }]);

      const result = await h.service.getSummary(USER_ID);

      expect(result).toEqual({
        totalEarnedPhp: 12345.67,
        thisMonthPhp: 2000,
        pendingInvoicesPhp: 9999.99,
        pendingInvoicesCount: 5,
        invoiceCountThisMonth: 3,
        savingsVsPaypalPhp: 543.21,
      });
    });

    it("forwards userId to every aggregate and the raw savings query", async () => {
      stubEmptySummary(h);

      await h.service.getSummary(USER_ID);

      expect(h.prisma.payment.aggregate).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: expect.objectContaining({ userId: USER_ID }),
        }),
      );
      expect(h.prisma.payment.aggregate).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: expect.objectContaining({ userId: USER_ID }),
        }),
      );
      expect(h.prisma.invoice.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: USER_ID }),
        }),
      );
      expect(h.prisma.$queryRaw.mock.calls[0]).toContain(USER_ID);
    });

    it("filters pending invoices by lowercase 'sent' status (regression guard against 'SENT')", async () => {
      stubEmptySummary(h);

      await h.service.getSummary(USER_ID);

      expect(h.prisma.invoice.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: "sent" }),
        }),
      );
    });

    it("sums Invoice.amount (regression guard against the ticket's `total` typo)", async () => {
      stubEmptySummary(h);

      await h.service.getSummary(USER_ID);

      expect(h.prisma.invoice.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          _sum: { amount: true },
        }),
      );
    });

    it("scopes the this-month aggregate to >= start of the current month", async () => {
      stubEmptySummary(h);
      const before = new Date();

      await h.service.getSummary(USER_ID);

      const monthStartCall = h.prisma.payment.aggregate.mock.calls[1]?.[0];
      const gte = (monthStartCall as { where: { paidAt: { gte: Date } } }).where.paidAt.gte;
      expect(gte).toBeInstanceOf(Date);
      expect(gte.getDate()).toBe(1);
      expect(gte.getFullYear()).toBe(before.getFullYear());
      expect(gte.getMonth()).toBe(before.getMonth());
    });
  });

  describe("getEarningsByMonth", () => {
    it("returns [] when no payments exist", async () => {
      h.prisma.$queryRaw.mockResolvedValueOnce([]);
      const result = await h.service.getEarningsByMonth(USER_ID, 12);
      expect(result).toEqual([]);
    });

    it("returns the rows untouched in the order the query produced", async () => {
      const rows = [
        { month: "2026-05", amountPhp: 1000, invoiceCount: 3 },
        { month: "2026-04", amountPhp: 500, invoiceCount: 1 },
      ];
      h.prisma.$queryRaw.mockResolvedValueOnce(rows);

      const result = await h.service.getEarningsByMonth(USER_ID, 12);
      expect(result).toEqual(rows);
    });

    it("forwards the months parameter into the query values", async () => {
      h.prisma.$queryRaw.mockResolvedValueOnce([]);
      await h.service.getEarningsByMonth(USER_ID, 24);
      expect(h.prisma.$queryRaw.mock.calls[0]).toContain(24);
    });

    it("forwards the userId into the query values (defense-in-depth)", async () => {
      h.prisma.$queryRaw.mockResolvedValueOnce([]);
      await h.service.getEarningsByMonth(USER_ID, 12);
      expect(h.prisma.$queryRaw.mock.calls[0]).toContain(USER_ID);
    });
  });

  describe("getEarningsByClient", () => {
    it("returns [] when no payments exist", async () => {
      h.prisma.$queryRaw.mockResolvedValueOnce([]);
      const result = await h.service.getEarningsByClient(USER_ID, 10);
      expect(result).toEqual([]);
    });

    it("normalizes lastPaidAt from Date to ISO string", async () => {
      const paidAt = new Date("2026-05-28T10:11:12.000Z");
      const rows = [
        {
          clientId: "11111111-1111-1111-1111-111111111111",
          clientName: "Acme",
          country: "US",
          totalPhp: 25000,
          invoiceCount: 5,
          lastPaidAt: paidAt,
        },
      ];
      h.prisma.$queryRaw.mockResolvedValueOnce(rows);

      const result = await h.service.getEarningsByClient(USER_ID, 10);

      expect(result[0].lastPaidAt).toBe("2026-05-28T10:11:12.000Z");
      expect(result[0].clientName).toBe("Acme");
      expect(result[0].country).toBe("US");
    });

    it("forwards the limit parameter into the query values", async () => {
      h.prisma.$queryRaw.mockResolvedValueOnce([]);
      await h.service.getEarningsByClient(USER_ID, 25);
      expect(h.prisma.$queryRaw.mock.calls[0]).toContain(25);
    });

    it("forwards the userId into the query values (defense-in-depth)", async () => {
      h.prisma.$queryRaw.mockResolvedValueOnce([]);
      await h.service.getEarningsByClient(USER_ID, 10);
      expect(h.prisma.$queryRaw.mock.calls[0]).toContain(USER_ID);
    });
  });

  describe("getEarningsByCountry", () => {
    it("returns [] when no payments exist", async () => {
      h.prisma.$queryRaw.mockResolvedValueOnce([]);
      const result = await h.service.getEarningsByCountry(USER_ID);
      expect(result).toEqual([]);
    });

    it("returns the rows in DESC totalPhp order produced by the query", async () => {
      const rows = [
        { country: "US", totalPhp: 30000, invoiceCount: 5, clientCount: 2 },
        { country: "PH", totalPhp: 10000, invoiceCount: 3, clientCount: 1 },
      ];
      h.prisma.$queryRaw.mockResolvedValueOnce(rows);

      const result = await h.service.getEarningsByCountry(USER_ID);
      expect(result).toEqual(rows);
    });

    it("passes through 'XX' for rows whose country was null (raw SQL coalesces)", async () => {
      const rows = [
        { country: "US", totalPhp: 20000, invoiceCount: 4, clientCount: 1 },
        { country: "XX", totalPhp: 5000, invoiceCount: 2, clientCount: 1 },
      ];
      h.prisma.$queryRaw.mockResolvedValueOnce(rows);

      const result = await h.service.getEarningsByCountry(USER_ID);
      expect(result[1].country).toBe("XX");
    });

    it("forwards the userId into the query values (defense-in-depth)", async () => {
      h.prisma.$queryRaw.mockResolvedValueOnce([]);
      await h.service.getEarningsByCountry(USER_ID);
      expect(h.prisma.$queryRaw.mock.calls[0]).toContain(USER_ID);
    });
  });
});
