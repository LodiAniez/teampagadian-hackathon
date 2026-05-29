import { useState, useEffect } from "react";
import { useChartPressState } from "victory-native";
import { useDashboardSummary } from "../../hooks/use-dashboard-summary";
import { formatPhp } from "@/lib/format";

export type TooltipInfo = { label: string; x: number; y: number };

export function useEarningsBarChart() {
  const { data, isLoading, error } = useDashboardSummary();
  const { state, isActive } = useChartPressState({ x: "", y: { amountPhp: 0 } });
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);

  useEffect(() => {
    if (!isActive) {
      setTooltip(null);
      return;
    }
    setTooltip({
      label: formatPhp(state.y.amountPhp.value.value),
      x: state.x.position.value,
      y: state.y.amountPhp.position.value,
    });
  }, [isActive, state]);

  return { data, isLoading, error, chartPressState: state, tooltip };
}
