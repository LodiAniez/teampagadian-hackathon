import { useMemo } from "react";
import { api } from "@/lib/api-client";
import type { EarningsByMonth } from "@raket/contracts";

export type MonthBarDatum = {
  month: string;
  amountPhp: number;
};

export function useDashboardSummary() {
  const query = api.dashboard.getEarningsByMonth.useQuery(["dashboard", "earnings-by-month"], {
    query: { months: 6 },
  });

  const data = useMemo<MonthBarDatum[]>(() => {
    return (query.data?.body ?? []).map((r: EarningsByMonth) => ({
      month: new Date(r.month + "-01").toLocaleDateString("en-PH", { month: "short" }),
      amountPhp: r.amountPhp,
    }));
  }, [query.data]);

  return { data, isLoading: query.isPending, error: query.error };
}
