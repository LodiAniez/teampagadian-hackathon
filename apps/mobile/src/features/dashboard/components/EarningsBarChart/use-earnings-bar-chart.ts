import { useState, useMemo } from "react";
import { useDashboardSummary } from "../../hooks/use-dashboard-summary";
import { formatPhp } from "@/lib/format";

export function useEarningsBarChart() {
  const { data, isLoading, error } = useDashboardSummary();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const rows = useMemo(
    () => data.map((d) => ({ ...d, formattedAmount: formatPhp(d.amountPhp) })),
    [data],
  );
  const max = useMemo(() => Math.max(...rows.map((r) => r.amountPhp), 1), [rows]);

  return { data: rows, max, isLoading, error, selectedIndex, onSelect: setSelectedIndex };
}
