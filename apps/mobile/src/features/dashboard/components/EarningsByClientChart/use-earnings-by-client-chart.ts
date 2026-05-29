import { useState } from "react";
import { useEarningsByClient } from "../../hooks/use-earnings-by-client";
import { formatPhp } from "@/lib/format";

export function useEarningsByClientChart() {
  const { data, max, isLoading, error } = useEarningsByClient();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const rows = data.map((d, i) => ({
    ...d,
    fillRatio: max > 0 ? d.totalPhp / max : 0,
    formattedTotal: formatPhp(d.totalPhp),
    isSelected: selectedIndex === i,
  }));

  return { rows, isLoading, error, onPress: setSelectedIndex };
}
