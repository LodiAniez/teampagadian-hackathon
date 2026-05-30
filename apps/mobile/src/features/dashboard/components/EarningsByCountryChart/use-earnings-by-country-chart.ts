import { useState } from "react";
import { useEarningsByCountry, type CountrySlice } from "../../hooks/use-earnings-by-country";
import { formatPhp } from "@/lib/format";

export type CountrySliceViewModel = CountrySlice & {
  percentage: string;
  formattedTotal: string;
  isSelected: boolean;
};

export function useEarningsByCountryChart() {
  const { slices, total, isLoading, error } = useEarningsByCountry();
  const [selected, setSelected] = useState<string | null>(null);

  const viewModel: CountrySliceViewModel[] = slices.map((s) => ({
    ...s,
    percentage: total > 0 ? ((s.totalPhp / total) * 100).toFixed(0) + "%" : "0%",
    formattedTotal: formatPhp(s.totalPhp),
    isSelected: selected === s.country,
  }));

  return {
    slices: viewModel,
    total,
    isLoading,
    error,
    onSlicePress: (country: string) => setSelected((prev) => (prev === country ? null : country)),
  };
}
