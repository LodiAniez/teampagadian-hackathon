import type { EarningsByMonth } from "@raket/contracts";

export type MonthOverMonthDelta = {
  deltaPhp: number;
  // null when the prior month earned nothing — a percentage has no meaningful base.
  deltaPct: number | null;
  direction: "up" | "down" | "flat";
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Derives the current-vs-previous month earnings delta from the by-month series
 * (the summary endpoint has no "last month" field). Returns null when there
 * aren't two months to compare. Input order is not assumed — months are sorted
 * by their YYYY-MM key and the two latest are used.
 */
export function computeMonthOverMonthDelta(
  months: Pick<EarningsByMonth, "month" | "amountPhp">[],
): MonthOverMonthDelta | null {
  if (months.length < 2) return null;

  const sorted = [...months].sort((a, b) => a.month.localeCompare(b.month));
  const current = sorted[sorted.length - 1].amountPhp;
  const prior = sorted[sorted.length - 2].amountPhp;

  const deltaPhp = round2(current - prior);
  const deltaPct = prior > 0 ? round2((deltaPhp / prior) * 100) : null;
  const direction = deltaPhp > 0 ? "up" : deltaPhp < 0 ? "down" : "flat";

  return { deltaPhp, deltaPct, direction };
}
