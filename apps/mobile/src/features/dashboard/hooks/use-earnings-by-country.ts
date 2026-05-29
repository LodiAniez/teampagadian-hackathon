import { useMemo } from "react";
import { api } from "@/lib/api-client";
import type { EarningsByCountry } from "@raket/contracts";

const PALETTE = ["#059669", "#10b981", "#34d399", "#6ee7b7"];

export type CountrySlice = {
  country: string;
  totalPhp: number;
  color: string;
};

export function useEarningsByCountry() {
  const query = api.dashboard.getEarningsByCountry.useQuery(
    ["dashboard", "earnings-by-country"],
    {},
  );

  const slices = useMemo<CountrySlice[]>(() => {
    const rows: EarningsByCountry[] = query.data?.body ?? [];
    const top3 = rows.slice(0, 3).map((r, i) => ({
      country: r.country,
      totalPhp: r.totalPhp,
      color: PALETTE[i],
    }));
    const otherTotal = rows.slice(3).reduce((sum, r) => sum + r.totalPhp, 0);
    if (otherTotal > 0) {
      top3.push({ country: "Other", totalPhp: otherTotal, color: PALETTE[3] });
    }
    return top3;
  }, [query.data]);

  const total = useMemo(() => slices.reduce((s, r) => s + r.totalPhp, 0), [slices]);

  return { slices, total, isLoading: query.isPending, error: query.error };
}
