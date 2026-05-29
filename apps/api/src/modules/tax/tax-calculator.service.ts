import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { BirElection, TaxComputation } from "@raket/contracts";
import { PrismaService } from "../../common/prisma/prisma.service";
import { PH_TAX_RATES } from "./ph-tax-rates";
import { annualRange, applyGraduatedBrackets, quarterRange, round2 } from "./tax-math";

type PaymentRow = {
  amountPhp: Prisma.Decimal;
  paidAt: Date;
  invoice: { client: { name: string } };
};

@Injectable()
export class TaxCalculatorService {
  constructor(private readonly prisma: PrismaService) {}

  async computeQuarterly(
    userId: string,
    quarter: 1 | 2 | 3,
    year: number,
    election: BirElection,
  ): Promise<TaxComputation> {
    const { start, end } = quarterRange(quarter, year);
    const payments = await this.fetchSettledPayments(userId, start, end);
    const grossReceipts = sumGross(payments);

    const { taxDuePhp, breakdown } =
      election === "EIGHT_PERCENT"
        ? compute8Percent(grossReceipts, { applyAnnualExemption: false })
        : computeGraduated(grossReceipts);

    return {
      grossReceiptsPhp: round2(grossReceipts),
      election,
      taxDuePhp,
      formCode: "1701Q",
      formName: "Quarterly Income Tax Return",
      deadline: PH_TAX_RATES.DEADLINES[`1701Q_Q${quarter}` as const],
      breakdown,
      invoiceCount: payments.length,
      paymentBreakdown: payments.map(toPaymentBreakdownRow),
    };
  }

  async computeAnnual(
    userId: string,
    year: number,
    election: BirElection,
  ): Promise<TaxComputation> {
    const { start, end } = annualRange(year);
    const payments = await this.fetchSettledPayments(userId, start, end);
    const grossReceipts = sumGross(payments);

    const { taxDuePhp, breakdown } =
      election === "EIGHT_PERCENT"
        ? compute8Percent(grossReceipts, { applyAnnualExemption: true })
        : computeGraduated(grossReceipts);

    // TODO(post-hackathon): support per-year annual deadline lookup
    // (TY2027, TY2028, ...). ph-tax-rates.ts only carries TY2026 today.
    return {
      grossReceiptsPhp: round2(grossReceipts),
      election,
      taxDuePhp,
      formCode: election === "EIGHT_PERCENT" ? "1701A" : "1701",
      formName:
        election === "EIGHT_PERCENT"
          ? "Annual Income Tax Return (8% election)"
          : "Annual Income Tax Return",
      deadline: PH_TAX_RATES.DEADLINES["1701_ANNUAL_TY2026"],
      breakdown,
      invoiceCount: payments.length,
      paymentBreakdown: payments.map(toPaymentBreakdownRow),
    };
  }

  private fetchSettledPayments(userId: string, start: Date, end: Date): Promise<PaymentRow[]> {
    return this.prisma.payment.findMany({
      where: {
        userId,
        morphTxStatus: "SETTLED",
        paidAt: { gte: start, lte: end },
      },
      include: { invoice: { include: { client: { select: { name: true } } } } },
      orderBy: { paidAt: "asc" },
    });
  }
}

function sumGross(payments: ReadonlyArray<PaymentRow>): number {
  return payments.reduce((sum, p) => sum + Number(p.amountPhp), 0);
}

function compute8Percent(
  grossReceipts: number,
  { applyAnnualExemption }: { applyAnnualExemption: boolean },
): { taxDuePhp: number; breakdown: string } {
  const exemption = applyAnnualExemption ? PH_TAX_RATES.EIGHT_PERCENT.annualExemption : 0;
  const taxable = Math.max(0, grossReceipts - exemption);
  const taxDuePhp = round2(taxable * PH_TAX_RATES.EIGHT_PERCENT.rate);
  const breakdown = applyAnnualExemption
    ? `(₱${fmt(grossReceipts)} - ₱${fmt(exemption)}) × 8% = ₱${fmt(taxDuePhp)}`
    : `₱${fmt(grossReceipts)} × 8% = ₱${fmt(taxDuePhp)}`;
  return { taxDuePhp, breakdown };
}

function computeGraduated(grossReceipts: number): {
  taxDuePhp: number;
  breakdown: string;
} {
  const taxDuePhp = applyGraduatedBrackets(grossReceipts);
  const breakdown = `Graduated tax on ₱${fmt(grossReceipts)}: ₱${fmt(taxDuePhp)}`;
  return { taxDuePhp, breakdown };
}

function fmt(n: number): string {
  return n.toLocaleString("en-PH");
}

function toPaymentBreakdownRow(p: PaymentRow): {
  date: string;
  client: string;
  amountPhp: number;
} {
  return {
    date: p.paidAt.toISOString().slice(0, 10),
    client: p.invoice.client.name,
    amountPhp: Number(p.amountPhp),
  };
}
