import type { FxComparison, FxProviderComparison } from "@raket/contracts";
import { formatPhp } from "@/lib/format";

export type FxDisplayRow = {
  provider: FxProviderComparison["provider"];
  label: string;
  feePctLabel: string;
  receivedLabel: string;
  // null on the Raket row (nothing to compare against itself).
  vsRaketLabel: string | null;
  highlighted: boolean;
  // True for the single provider that nets the freelancer the most. Data-driven
  // off receivedPhp so the "Best rate" badge can never assert a false claim.
  isBest: boolean;
};

export function formatFeePct(pct: number): string {
  return `${pct.toFixed(2)}%`;
}

/**
 * Renders the "vs Raket" delta from a provider row. deltaVsRaketPhp is
 * raket.received - provider.received, so a positive value means the provider
 * nets the freelancer less than Raket (shown as a loss) and a negative value
 * means it nets more (e.g. Wise's lower fee — shown as a gain).
 */
export function formatVsRaket(row: FxProviderComparison): string | null {
  if (row.provider === "raket") return null;
  if (row.deltaVsRaketPhp > 0) return `−${formatPhp(row.deltaVsRaketPhp)} vs Raket`;
  if (row.deltaVsRaketPhp < 0) return `+${formatPhp(Math.abs(row.deltaVsRaketPhp))} vs Raket`;
  return "Same as Raket";
}

export function buildFxRows(comparison: FxComparison): FxDisplayRow[] {
  // The best provider is the one with the highest net. `providers` is ordered
  // raket-first, so `find` resolves ties to Raket.
  const maxReceivedPhp = Math.max(...comparison.providers.map((p) => p.receivedPhp));
  const bestProvider = comparison.providers.find((p) => p.receivedPhp === maxReceivedPhp)?.provider;

  return comparison.providers.map((p) => ({
    provider: p.provider,
    label: p.label,
    feePctLabel: formatFeePct(p.feePct),
    receivedLabel: formatPhp(p.receivedPhp),
    vsRaketLabel: formatVsRaket(p),
    highlighted: p.provider === "raket",
    isBest: p.provider === bestProvider,
  }));
}
