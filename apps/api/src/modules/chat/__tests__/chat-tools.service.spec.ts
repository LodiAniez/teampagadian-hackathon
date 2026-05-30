import { Prisma } from "@prisma/client";
import type { TaxComputation } from "@raket/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import { PrismaService } from "../../../common/prisma/prisma.service";
import { TaxCalculatorService } from "../../tax/tax-calculator.service";
import { buildChatToolDefs } from "../chat-tools";
import { ChatToolsService } from "../chat-tools.service";

const USER_ID = "f0e1d2c3-b4a5-6e7d-8c9b-0a1b2c3d4e5f";
const OTHER_USER_ID = "00000000-0000-0000-0000-0000000000ff";

type Harness = {
  service: ChatToolsService;
  prisma: DeepMockProxy<PrismaService>;
  tax: DeepMockProxy<TaxCalculatorService>;
};

function buildHarness(): Harness {
  const prisma = mockDeep<PrismaService>();
  const tax = mockDeep<TaxCalculatorService>();
  const service = new ChatToolsService(prisma, tax);
  return { service, prisma, tax };
}

// Prisma.sql(...) passes a single Sql object as the first arg to $queryRaw; its
// bound parameter values live on `.values`. Tests assert on those to prove
// userId / date / filter parameterization without coupling to SQL whitespace.
function rawValues(prisma: DeepMockProxy<PrismaService>, call = 0): unknown[] {
  const arg = prisma.$queryRaw.mock.calls[call]?.[0] as Prisma.Sql;
  return arg.values;
}

describe("ChatToolsService", () => {
  let h: Harness;

  beforeEach(() => {
    h = buildHarness();
  });

  describe("queryEarnings", () => {
    it("groups rows and derives totals from them when group_by is set", async () => {
      h.prisma.$queryRaw.mockResolvedValueOnce([
        { label: "Acme Northwind", amountPhp: 1000, invoiceCount: 2 },
        { label: "Pixel Forge", amountPhp: 500, invoiceCount: 1 },
      ]);

      const result = await h.service.queryEarnings(USER_ID, {
        start_date: "2026-01-01",
        end_date: "2026-03-31",
        group_by: "client",
      });

      expect(result).toEqual({
        groupBy: "client",
        startDate: "2026-01-01",
        endDate: "2026-03-31",
        totalPhp: 1500,
        invoiceCount: 3,
        rows: [
          { label: "Acme Northwind", amountPhp: 1000, invoiceCount: 2 },
          { label: "Pixel Forge", amountPhp: 500, invoiceCount: 1 },
        ],
      });
    });

    it("returns a totals-only result with empty rows when ungrouped", async () => {
      h.prisma.$queryRaw.mockResolvedValueOnce([{ totalPhp: 1500, invoiceCount: 3 }]);

      const result = await h.service.queryEarnings(USER_ID, {
        start_date: "2026-01-01",
        end_date: "2026-03-31",
      });

      expect(result).toEqual({
        groupBy: null,
        startDate: "2026-01-01",
        endDate: "2026-03-31",
        totalPhp: 1500,
        invoiceCount: 3,
        rows: [],
      });
    });

    it("returns zeros (not null) for a range with no payments", async () => {
      h.prisma.$queryRaw.mockResolvedValueOnce([{ totalPhp: 0, invoiceCount: 0 }]);

      const result = await h.service.queryEarnings(USER_ID, {
        start_date: "2026-01-01",
        end_date: "2026-03-31",
      });

      expect(result.totalPhp).toBe(0);
      expect(result.invoiceCount).toBe(0);
      expect(result.rows).toEqual([]);
    });

    it("forwards userId and the date range into the query parameters", async () => {
      h.prisma.$queryRaw.mockResolvedValueOnce([{ totalPhp: 0, invoiceCount: 0 }]);

      await h.service.queryEarnings(USER_ID, {
        start_date: "2026-01-01",
        end_date: "2026-03-31",
      });

      const values = rawValues(h.prisma);
      expect(values).toContain(USER_ID);
      expect(values).toContain("2026-01-01");
      expect(values).toContain("2026-03-31");
    });

    it("adds country and client_name to the query parameters when provided", async () => {
      h.prisma.$queryRaw.mockResolvedValueOnce([{ totalPhp: 0, invoiceCount: 0 }]);

      await h.service.queryEarnings(USER_ID, {
        start_date: "2026-01-01",
        end_date: "2026-03-31",
        country: "US",
        client_name: "Acme",
      });

      const values = rawValues(h.prisma);
      expect(values).toContain("US");
      expect(values.some((v) => typeof v === "string" && v.includes("Acme"))).toBe(true);
    });

    it("groups by client id (not name) so distinct same-named clients stay separate", async () => {
      h.prisma.$queryRaw.mockResolvedValueOnce([]);

      await h.service.queryEarnings(USER_ID, {
        start_date: "2026-01-01",
        end_date: "2026-03-31",
        group_by: "client",
      });

      const sql = (h.prisma.$queryRaw.mock.calls[0]?.[0] as Prisma.Sql).sql;
      expect(sql).toMatch(/GROUP BY\s+c\.id/);
    });
  });

  describe("getInvoiceStatus", () => {
    const invoiceRow = {
      id: "11111111-1111-1111-1111-111111111111",
      number: "INV-2026-0001",
      status: "paid" as const,
      amount: new Prisma.Decimal("1500.00"),
      currency: "USD",
      issueDate: new Date("2026-01-10T00:00:00.000Z"),
      dueDate: new Date("2026-02-09T00:00:00.000Z"),
      client: { name: "Acme Northwind" },
    };

    it("maps invoices and returns the true total count", async () => {
      h.prisma.invoice.findMany.mockResolvedValueOnce([invoiceRow] as never);
      h.prisma.invoice.count.mockResolvedValueOnce(7);

      const result = await h.service.getInvoiceStatus(USER_ID, { limit: 5 });

      expect(result).toEqual({
        count: 7,
        invoices: [
          {
            id: "11111111-1111-1111-1111-111111111111",
            number: "INV-2026-0001",
            clientName: "Acme Northwind",
            status: "paid",
            amount: 1500,
            currency: "USD",
            issueDate: "2026-01-10",
            dueDate: "2026-02-09",
          },
        ],
      });
    });

    it("returns an empty list (not null) when nothing matches", async () => {
      h.prisma.invoice.findMany.mockResolvedValueOnce([] as never);
      h.prisma.invoice.count.mockResolvedValueOnce(0);

      const result = await h.service.getInvoiceStatus(USER_ID, { limit: 5 });

      expect(result).toEqual({ count: 0, invoices: [] });
    });

    it("scopes the query to the user and applies status + case-insensitive client filters", async () => {
      h.prisma.invoice.findMany.mockResolvedValueOnce([] as never);
      h.prisma.invoice.count.mockResolvedValueOnce(0);

      await h.service.getInvoiceStatus(USER_ID, {
        status: "sent",
        client_name: "acme",
        limit: 5,
      });

      expect(h.prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: USER_ID,
            status: "sent",
            client: { is: { name: { contains: "acme", mode: "insensitive" } } },
          }),
          take: 5,
        }),
      );
    });
  });

  describe("calculateTaxEstimate", () => {
    const computation: TaxComputation = {
      grossReceiptsPhp: 487200,
      election: "EIGHT_PERCENT",
      taxDuePhp: 38976,
      formCode: "1701Q",
      formName: "Quarterly Income Tax Return",
      deadline: "2026-05-15",
      breakdown: "₱487,200 × 8% = ₱38,976",
      invoiceCount: 4,
      paymentBreakdown: [],
    };

    it("delegates to the deterministic calculator using the user's election", async () => {
      h.prisma.user.findUnique.mockResolvedValueOnce({ bir2303Election: "GRADUATED" } as never);
      h.tax.computeQuarterly.mockResolvedValueOnce({ ...computation, election: "GRADUATED" });

      const result = await h.service.calculateTaxEstimate(USER_ID, { quarter: 1, year: 2026 });

      expect(h.tax.computeQuarterly).toHaveBeenCalledWith(USER_ID, 1, 2026, "GRADUATED");
      expect(result.election).toBe("GRADUATED");
    });

    it("defaults to the 8% election when the user has none set", async () => {
      h.prisma.user.findUnique.mockResolvedValueOnce({ bir2303Election: null } as never);
      h.tax.computeQuarterly.mockResolvedValueOnce(computation);

      await h.service.calculateTaxEstimate(USER_ID, { quarter: 2, year: 2026 });

      expect(h.tax.computeQuarterly).toHaveBeenCalledWith(USER_ID, 2, 2026, "EIGHT_PERCENT");
    });

    it("looks up the election for the requesting user only", async () => {
      h.prisma.user.findUnique.mockResolvedValueOnce({ bir2303Election: null } as never);
      h.tax.computeQuarterly.mockResolvedValueOnce(computation);

      await h.service.calculateTaxEstimate(USER_ID, { quarter: 1, year: 2026 });

      expect(h.prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: USER_ID } }),
      );
    });
  });

  describe("getClientSummary", () => {
    it("returns the top client with a rounded average and ISO last-paid date", async () => {
      h.prisma.$queryRaw.mockResolvedValueOnce([
        {
          name: "Acme Northwind",
          country: "US",
          totalEarnedPhp: 412800,
          invoiceCount: 6,
          lastPaidAt: new Date("2026-05-09T08:00:00.000Z"),
          averageInvoicePhp: 68800.001,
        },
      ]);

      const result = await h.service.getClientSummary(USER_ID, {});

      expect(result).toEqual({
        name: "Acme Northwind",
        country: "US",
        totalEarnedPhp: 412800,
        invoiceCount: 6,
        lastPaidDate: "2026-05-09",
        averageInvoicePhp: 68800,
      });
    });

    it("returns null when the user has no matching paid client", async () => {
      h.prisma.$queryRaw.mockResolvedValueOnce([]);

      const result = await h.service.getClientSummary(USER_ID, { client_name: "Nope" });

      expect(result).toBeNull();
    });

    it("forwards userId and the client_name filter into the query parameters", async () => {
      h.prisma.$queryRaw.mockResolvedValueOnce([]);

      await h.service.getClientSummary(USER_ID, { client_name: "Acme" });

      const values = rawValues(h.prisma);
      expect(values).toContain(USER_ID);
      expect(values.some((v) => typeof v === "string" && v.includes("Acme"))).toBe(true);
    });
  });
});

describe("buildChatToolDefs", () => {
  it("defines exactly the four chat tools", () => {
    const service = mockDeep<ChatToolsService>();
    const defs = buildChatToolDefs(service);
    expect(Object.keys(defs).sort()).toEqual(
      [
        "calculate_tax_estimate",
        "get_client_summary",
        "get_invoice_status",
        "query_earnings",
      ].sort(),
    );
  });

  it("injects userId into execute (never a model-supplied parameter) and parses input", async () => {
    const service = mockDeep<ChatToolsService>();
    service.queryEarnings.mockResolvedValueOnce({
      groupBy: null,
      startDate: "2026-01-01",
      endDate: "2026-03-31",
      totalPhp: 0,
      invoiceCount: 0,
      rows: [],
    });
    const defs = buildChatToolDefs(service);

    await defs.query_earnings.execute(USER_ID, {
      start_date: "2026-01-01",
      end_date: "2026-03-31",
    });

    expect(service.queryEarnings).toHaveBeenCalledWith(USER_ID, {
      start_date: "2026-01-01",
      end_date: "2026-03-31",
    });
    // userId is not part of the tool's declared parameters
    expect(Object.keys(defs.query_earnings.parameters.shape)).not.toContain("userId");
  });

  it("rejects tool input that fails the parameter schema before hitting the service", async () => {
    const service = mockDeep<ChatToolsService>();
    const defs = buildChatToolDefs(service);

    await expect(
      defs.query_earnings.execute(USER_ID, { end_date: "2026-03-31" }),
    ).rejects.toThrow();
    expect(service.queryEarnings).not.toHaveBeenCalled();
  });

  it("does not let one user's id be overridden by tool input", async () => {
    const service = mockDeep<ChatToolsService>();
    service.getClientSummary.mockResolvedValueOnce(null);
    const defs = buildChatToolDefs(service);

    // Even if the model emits a userId-like field, it's ignored — the closure arg wins.
    await defs.get_client_summary.execute(USER_ID, { client_name: "Acme", userId: OTHER_USER_ID });

    expect(service.getClientSummary).toHaveBeenCalledWith(USER_ID, { client_name: "Acme" });
  });
});
