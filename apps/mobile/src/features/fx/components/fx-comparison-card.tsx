import { memo } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Card } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useFxComparison } from "../hooks/use-fx-comparison";
import { buildFxRows, type FxDisplayRow } from "./fx-display";
import { SavingsCounter } from "./SavingsCounter";

type FxComparisonCardProps = {
  usdAmount: number;
  country?: string;
};

export const FxComparisonCard = memo(function FxComparisonCard({
  usdAmount,
  country,
}: FxComparisonCardProps) {
  const { comparison, isLoading, isError } = useFxComparison({ usdAmount });

  if (isLoading) {
    return (
      <Card className="h-40 items-center justify-center">
        <ActivityIndicator color="#059669" />
      </Card>
    );
  }

  if (isError || !comparison) {
    return (
      <Card className="h-40 items-center justify-center">
        <Text className="text-sm text-gray-400">FX rates unavailable right now</Text>
      </Card>
    );
  }

  const rows = buildFxRows(comparison);

  return (
    <Card className="gap-3">
      <View className="gap-0.5">
        <Text className="text-xs font-medium uppercase tracking-wide text-gray-500">
          You save with Raket{country ? ` · ${country}` : ""}
        </Text>
        <SavingsCounter value={comparison.savedVsPaypalPhp} />
        <Text className="text-xs text-gray-400">
          vs PayPal on ${comparison.usdAmount.toLocaleString("en-US")} · ₱
          {comparison.phpRate.toFixed(2)}/$
        </Text>
      </View>

      <View className="gap-1">
        {rows.map((row) => (
          <FxRow key={row.provider} row={row} />
        ))}
      </View>
    </Card>
  );
});

function FxRow({ row }: { row: FxDisplayRow }) {
  return (
    <View
      className={cn(
        "flex-row items-center justify-between rounded-lg px-3 py-2",
        row.highlighted ? "bg-emerald-50" : "bg-transparent",
      )}
    >
      {/* flex-1 + flex-shrink so long labels wrap instead of overflowing ~320px */}
      <View className="flex-1 pr-2">
        <Text
          className={cn(
            "text-sm font-semibold",
            row.highlighted ? "text-emerald-700" : "text-gray-800",
          )}
        >
          {row.label}
        </Text>
        <Text className="text-xs text-gray-400">{row.feePctLabel} fee</Text>
      </View>
      <View className="items-end">
        <Text
          className={cn(
            "text-sm font-semibold",
            row.highlighted ? "text-emerald-700" : "text-gray-800",
          )}
        >
          {row.receivedLabel}
        </Text>
        {row.isBest ? (
          <Text className="text-xs font-medium text-emerald-600">Best rate</Text>
        ) : row.vsRaketLabel ? (
          <Text className="text-xs text-gray-400">{row.vsRaketLabel}</Text>
        ) : null}
      </View>
    </View>
  );
}
