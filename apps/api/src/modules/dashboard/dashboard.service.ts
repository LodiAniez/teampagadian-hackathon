import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  EarningsByClient,
  EarningsByCountry,
  EarningsByMonth,
  EarningsSummary,
} from "@raket/contracts";
import { PrismaService } from "../../common/prisma/prisma.service";

// Decimal | null → number. Number(null) coerces to 0, but routing it through
// this guard keeps the intent explicit and matches the contract's nonnegative
// number expectation.
function decimalToNumber(value: Prisma.Decimal | null): number {
  return value ? Number(value) : 0;
}

// Shape of the raw rows returned by the by-client raw query. `lastPaidAt`
// arrives as a Date from the pg driver; we normalize to ISO in the mapper
// because the contract advertises a string field.
type EarningsByClientRow = Omit<EarningsByClient, "lastPaidAt"> & {
  lastPaidAt: Date | string;
};

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(userId: string): Promise<EarningsSummary> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalAgg, thisMonthAgg, pendingAgg, savingsRows] = await Promise.all([
      this.prisma.payment.aggregate({
        where: { userId },
        _sum: { amountPhp: true },
      }),
      this.prisma.payment.aggregate({
        where: { userId, paidAt: { gte: monthStart } },
        _sum: { amountPhp: true },
        _count: true,
      }),
      this.prisma.invoice.aggregate({
        where: { userId, status: "sent" },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.$queryRaw<{ savings: number }[]>`
        SELECT COALESCE(SUM(amount_received * fx_rate * 0.069), 0)::float AS savings
        FROM payments
        WHERE user_id = ${userId}::uuid
      `,
    ]);

    return {
      totalEarnedPhp: decimalToNumber(totalAgg._sum.amountPhp),
      thisMonthPhp: decimalToNumber(thisMonthAgg._sum.amountPhp),
      pendingInvoicesPhp: decimalToNumber(pendingAgg._sum.amount),
      pendingInvoicesCount: pendingAgg._count,
      invoiceCountThisMonth: thisMonthAgg._count,
      savingsVsPaypalPhp: Number(savingsRows[0]?.savings ?? 0),
    };
  }

  async getEarningsByMonth(userId: string, months: number): Promise<EarningsByMonth[]> {
    return this.prisma.$queryRaw<EarningsByMonth[]>`
      SELECT
        TO_CHAR(paid_at, 'YYYY-MM') AS month,
        SUM(amount_php)::float AS "amountPhp",
        COUNT(id)::int AS "invoiceCount"
      FROM payments
      WHERE user_id = ${userId}::uuid
        AND paid_at >= NOW() - make_interval(months => ${months}::int)
      GROUP BY TO_CHAR(paid_at, 'YYYY-MM')
      ORDER BY month DESC
    `;
  }

  async getEarningsByClient(userId: string, limit: number): Promise<EarningsByClient[]> {
    const rows = await this.prisma.$queryRaw<EarningsByClientRow[]>`
      SELECT
        c.id AS "clientId",
        c.name AS "clientName",
        c.country AS country,
        SUM(p.amount_php)::float AS "totalPhp",
        COUNT(p.id)::int AS "invoiceCount",
        MAX(p.paid_at) AS "lastPaidAt"
      FROM payments p
      JOIN invoices i ON i.id = p.invoice_id
      JOIN clients c ON c.id = i.client_id
      WHERE p.user_id = ${userId}::uuid
      GROUP BY c.id, c.name, c.country
      ORDER BY "totalPhp" DESC
      LIMIT ${limit}
    `;
    return rows.map((row) => ({
      ...row,
      lastPaidAt: new Date(row.lastPaidAt).toISOString(),
    }));
  }

  async getEarningsByCountry(userId: string): Promise<EarningsByCountry[]> {
    return this.prisma.$queryRaw<EarningsByCountry[]>`
      SELECT
        COALESCE(c.country, 'XX') AS country,
        SUM(p.amount_php)::float AS "totalPhp",
        COUNT(p.id)::int AS "invoiceCount",
        COUNT(DISTINCT c.id)::int AS "clientCount"
      FROM payments p
      JOIN invoices i ON i.id = p.invoice_id
      JOIN clients c ON c.id = i.client_id
      WHERE p.user_id = ${userId}::uuid
      GROUP BY COALESCE(c.country, 'XX')
      ORDER BY "totalPhp" DESC
    `;
  }
}
