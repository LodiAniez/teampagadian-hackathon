import React, { memo } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { useEarningsByClientChart } from "./use-earnings-by-client-chart";

export const EarningsByClientChart = memo(function EarningsByClientChart() {
  const { rows, isLoading, error, onPress } = useEarningsByClientChart();

  if (isLoading) {
    return (
      <View className="h-40 items-center justify-center">
        <ActivityIndicator color="#059669" />
      </View>
    );
  }

  if (error || rows.length === 0) {
    return (
      <View className="h-40 items-center justify-center">
        <Text className="text-sm text-gray-400">No data yet</Text>
      </View>
    );
  }

  return (
    <View className="gap-3">
      {rows.map((row, i) => (
        <Pressable key={row.clientName} onPress={() => onPress(row.isSelected ? null : i)}>
          <View className="flex-row items-center gap-2">
            <Text className="w-28 text-xs text-gray-600 dark:text-gray-300" numberOfLines={1}>
              {row.clientName}
            </Text>

            <View className="h-6 flex-1 overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-900">
              <View
                className="h-full rounded-full bg-emerald-600"
                style={{ width: `${row.fillRatio * 100}%` }}
              />
            </View>
          </View>

          {row.isSelected && (
            <Text className="ml-28 mt-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              {row.formattedTotal} · {row.invoiceCount} invoice{row.invoiceCount !== 1 ? "s" : ""}
            </Text>
          )}
        </Pressable>
      ))}
    </View>
  );
});
