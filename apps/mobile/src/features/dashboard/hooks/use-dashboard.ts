import { useCallback, useState } from "react";
import { api } from "@/lib/api-client";
import { computeMonthOverMonthDelta } from "../utils/earnings-delta";
import { isDashboardEmpty } from "../utils/dashboard-state";
import { useEarningsSummary } from "./use-earnings-summary";
import { useRecentInvoices } from "./use-recent-invoices";

const RECENT_LIMIT = 5;
const MONTHS = 6;

/**
 * Composes the dashboard's three reads (KPI summary, 6-month earnings, recent
 * invoices) and the derived view-model (month-over-month delta, empty state),
 * plus a single pull-to-refresh that refetches all three. The by-month query
 * shares its key with EarningsBarChart's hook, so refresh updates the chart too
 * and there's no duplicate fetch.
 */
export function useDashboard() {
  const summary = useEarningsSummary();
  const recent = useRecentInvoices(RECENT_LIMIT);
  const months = api.dashboard.getEarningsByMonth.useQuery(["dashboard", "earnings-by-month"], {
    query: { months: MONTHS },
  });

  const monthsData = months.data?.status === 200 ? months.data.body : [];
  const monthlyDelta = computeMonthOverMonthDelta(monthsData);

  const isLoading = summary.isLoading || recent.isLoading;
  const isEmpty =
    !isLoading &&
    isDashboardEmpty({
      totalEarnedPhp: summary.summary?.totalEarnedPhp ?? 0,
      recentInvoiceCount: recent.invoices.length,
    });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([summary.refetch(), recent.refetch(), months.refetch()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [summary.refetch, recent.refetch, months.refetch]);

  return {
    summary: summary.summary,
    summaryLoading: summary.isLoading,
    monthlyDelta,
    recentInvoices: recent.invoices,
    recentLoading: recent.isLoading,
    isError: summary.isError || recent.isError,
    isEmpty,
    isRefreshing,
    refresh,
  };
}
