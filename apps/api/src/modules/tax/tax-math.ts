import { PH_TAX_RATES } from "./ph-tax-rates";

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function quarterRange(quarter: 1 | 2 | 3, year: number): { start: Date; end: Date } {
  const startMonth = (quarter - 1) * 3;
  const endMonth = startMonth + 3;
  return {
    start: new Date(Date.UTC(year, startMonth, 1, 0, 0, 0, 0)),
    // Day 0 of next month = last day of current month, in UTC.
    end: new Date(Date.UTC(year, endMonth, 0, 23, 59, 59, 999)),
  };
}

export function annualRange(year: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0)),
    end: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)),
  };
}

// Graduated income tax via TRAIN Phase 2 (2023+) brackets. Each bracket
// stores `baseAmount` = the total tax owed at the prior bracket's upper
// bound, so we add the marginal slice without re-summing the prefix.
export function applyGraduatedBrackets(taxable: number): number {
  if (taxable <= 0) return 0;
  const brackets = PH_TAX_RATES.GRADUATED_BRACKETS;
  let prevUpTo = 0;
  for (const b of brackets) {
    if (taxable <= b.upTo) {
      return round2(b.baseAmount + (taxable - prevUpTo) * b.rate);
    }
    prevUpTo = b.upTo;
  }
  return 0;
}
