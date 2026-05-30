import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  BirElection,
  ClientSummaryResult,
  EarningsResult,
  InvoiceStatusResult,
  TaxComputation,
} from "@raket/contracts";
import { SupportedCurrencySchema } from "@raket/contracts";
import { PrismaService } from "../../common/prisma/prisma.service";
import { TaxCalculatorService } from "../tax/tax-calculator.service";
import type {
  CalculateTaxEstimateInput,
  GetClientSummaryInput,
  GetInvoiceStatusInput,
  QueryEarningsInput,
} from "./chat-tools";

// "Earnings" mirrors the dashboard's definition: every received payment counts,
// regardless of on-chain settlement state (unlike tax gross receipts, which are
// SETTLED-only). All amounts are PHP — the assistant reports in PHP.

type GroupedEarningsRow = { label: string; amountPhp: number; invoiceCount: number };
type EarningsTotalsRow = { totalPhp: number; invoiceCount: number };
type ClientSummaryRow = {
  name: string;
  country: string | null;
  totalEarnedPhp: number;
  invoiceCount: number;
  lastPaidAt: Date | null;
  averageInvoicePhp: number;
};

@Injectable()
export class ChatToolsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taxCalculator: TaxCalculatorService,
  ) {}

  // ── query_earnings ──────────────────────────────────────────────────────────
  async queryEarnings(userId: string, input: QueryEarningsInput): Promise<EarningsResult> {
    const where = this.earningsWhere(userId, input);

    if (input.group_by) {
      const dimension = earningsDimension(input.group_by);
      const rows = await this.prisma.$queryRaw<GroupedEarningsRow[]>(Prisma.sql`
        SELECT ${dimension.label} AS label,
               SUM(p.amount_php)::float AS "amountPhp",
               COUNT(p.id)::int AS "invoiceCount"
        FROM payments p
        JOIN invoices i ON i.id = p.invoice_id
        JOIN clients c ON c.id = i.client_id
        WHERE ${where}
        GROUP BY ${dimension.group}
        ORDER BY "amountPhp" DESC
      `);
      return {
        groupBy: input.group_by,
        startDate: input.start_date,
        endDate: input.end_date,
        totalPhp: rows.reduce((sum, r) => sum + r.amountPhp, 0),
        invoiceCount: rows.reduce((sum, r) => sum + r.invoiceCount, 0),
        rows,
      };
    }

    const [totals] = await this.prisma.$queryRaw<EarningsTotalsRow[]>(Prisma.sql`
      SELECT COALESCE(SUM(p.amount_php), 0)::float AS "totalPhp",
             COUNT(p.id)::int AS "invoiceCount"
      FROM payments p
      JOIN invoices i ON i.id = p.invoice_id
      JOIN clients c ON c.id = i.client_id
      WHERE ${where}
    `);
    return {
      groupBy: null,
      startDate: input.start_date,
      endDate: input.end_date,
      totalPhp: totals?.totalPhp ?? 0,
      invoiceCount: totals?.invoiceCount ?? 0,
      rows: [],
    };
  }

  private earningsWhere(userId: string, input: QueryEarningsInput): Prisma.Sql {
    const filters: Prisma.Sql[] = [
      Prisma.sql`p.user_id = ${userId}::uuid`,
      Prisma.sql`p.paid_at >= ${input.start_date}::date`,
      Prisma.sql`p.paid_at < (${input.end_date}::date + INTERVAL '1 day')`,
    ];
    if (input.country) filters.push(Prisma.sql`c.country = ${input.country}`);
    if (input.client_name) filters.push(Prisma.sql`c.name ILIKE ${`%${input.client_name}%`}`);
    return Prisma.join(filters, " AND ");
  }

  // ── get_invoice_status ────────────────────────────────────────────────────────
  async getInvoiceStatus(
    userId: string,
    input: GetInvoiceStatusInput,
  ): Promise<InvoiceStatusResult> {
    const where: Prisma.InvoiceWhereInput = {
      userId,
      ...(input.status ? { status: input.status } : {}),
      ...(input.client_name
        ? { client: { is: { name: { contains: input.client_name, mode: "insensitive" } } } }
        : {}),
    };

    const [rows, count] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        select: {
          id: true,
          number: true,
          status: true,
          amount: true,
          currency: true,
          issueDate: true,
          dueDate: true,
          client: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      count,
      invoices: rows.map((row) => ({
        id: row.id,
        number: row.number,
        clientName: row.client.name,
        status: row.status,
        amount: Number(row.amount),
        currency: SupportedCurrencySchema.parse(row.currency),
        issueDate: toIsoDate(row.issueDate),
        dueDate: toIsoDate(row.dueDate),
      })),
    };
  }

  // ── calculate_tax_estimate ──────────────────────────────────────────────────
  // Delegates to the deterministic M8 calculator — never the LLM. Quarter is
  // 1-3 (BIR has no Q4 quarterly; the annual return absorbs it).
  async calculateTaxEstimate(
    userId: string,
    input: CalculateTaxEstimateInput,
  ): Promise<TaxComputation> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { bir2303Election: true },
    });
    const election: BirElection = user?.bir2303Election ?? "EIGHT_PERCENT";
    return this.taxCalculator.computeQuarterly(userId, input.quarter, input.year, election);
  }

  // ── get_client_summary ────────────────────────────────────────────────────────
  // Returns the top client by PHP earned (or the named one). Null when the user
  // has no matching paid client — the honest "no data" for a singular summary;
  // the list-shaped tools return empty arrays instead.
  async getClientSummary(
    userId: string,
    input: GetClientSummaryInput,
  ): Promise<ClientSummaryResult | null> {
    const filters: Prisma.Sql[] = [Prisma.sql`p.user_id = ${userId}::uuid`];
    if (input.client_name) filters.push(Prisma.sql`c.name ILIKE ${`%${input.client_name}%`}`);
    const where = Prisma.join(filters, " AND ");

    const [row] = await this.prisma.$queryRaw<ClientSummaryRow[]>(Prisma.sql`
      SELECT c.name AS name,
             c.country AS country,
             SUM(p.amount_php)::float AS "totalEarnedPhp",
             COUNT(p.id)::int AS "invoiceCount",
             MAX(p.paid_at) AS "lastPaidAt",
             AVG(p.amount_php)::float AS "averageInvoicePhp"
      FROM payments p
      JOIN invoices i ON i.id = p.invoice_id
      JOIN clients c ON c.id = i.client_id
      WHERE ${where}
      GROUP BY c.id, c.name, c.country
      ORDER BY "totalEarnedPhp" DESC
      LIMIT 1
    `);

    if (!row) return null;
    return {
      name: row.name,
      country: row.country,
      totalEarnedPhp: row.totalEarnedPhp,
      invoiceCount: row.invoiceCount,
      lastPaidDate: row.lastPaidAt ? toIsoDate(row.lastPaidAt) : null,
      averageInvoicePhp: round2(row.averageInvoicePhp),
    };
  }
}

// `label` is what the user sees; `group` is the aggregation key. They diverge
// for `client`: clients aren't unique by name (no DB constraint — see the Client
// model), so we group by the client id to keep distinct same-named clients
// separate, while still labelling each row with the name. c.id is the PK, so
// c.name is functionally dependent and selectable under this GROUP BY.
function earningsDimension(groupBy: NonNullable<QueryEarningsInput["group_by"]>): {
  label: Prisma.Sql;
  group: Prisma.Sql;
} {
  switch (groupBy) {
    case "client":
      return { label: Prisma.sql`c.name`, group: Prisma.sql`c.id, c.name` };
    case "country": {
      const country = Prisma.sql`COALESCE(c.country, 'XX')`;
      return { label: country, group: country };
    }
    case "month": {
      const month = Prisma.sql`TO_CHAR(p.paid_at, 'YYYY-MM')`;
      return { label: month, group: month };
    }
  }
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
