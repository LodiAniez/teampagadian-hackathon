import type { EarningsSummary } from "@raket/contracts";
import { api } from "@/lib/api-client";

export const EARNINGS_SUMMARY_QUERY_KEY = ["dashboard", "summary"] as const;

/**
 * Fetches the KPI summary (`GET /dashboard/summary`). Distinct from
 * `use-dashboard-summary.ts`, which — despite its name — fetches the by-month
 * chart series, not these KPIs. See the result notes for the naming decision.
 */
export function useEarningsSummary() {
  const query = api.dashboard.getSummary.useQuery(EARNINGS_SUMMARY_QUERY_KEY);
  const summary: EarningsSummary | undefined =
    query.data?.status === 200 ? query.data.body : undefined;

  return {
    summary,
    isLoading: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
  };
}
