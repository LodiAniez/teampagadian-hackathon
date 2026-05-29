import React, { memo } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { PolarChart, Pie } from "victory-native";
import { useEarningsByCountryChart } from "./use-earnings-by-country-chart";
import { formatPhp } from "@/lib/format";

export const EarningsByCountryChart = memo(function EarningsByCountryChart() {
  const { slices, total, isLoading, error, onSlicePress } = useEarningsByCountryChart();

  if (isLoading) {
    return (
      <View className="h-48 items-center justify-center">
        <ActivityIndicator color="#059669" />
      </View>
    );
  }

  if (error || slices.length === 0) {
    return (
      <View className="h-48 items-center justify-center">
        <Text className="text-sm text-gray-400">No data yet</Text>
      </View>
    );
  }

  const selected = slices.find((s) => s.isSelected);

  return (
    <View className="flex-row items-center gap-4">
      <View className="relative h-44 w-44">
        <PolarChart data={slices} labelKey="country" valueKey="totalPhp" colorKey="color">
          <Pie.Chart innerRadius="60%">
            {({ slice }) => (
              <Pie.Slice key={slice.label} animate={{ type: "spring", duration: 300 }} />
            )}
          </Pie.Chart>
        </PolarChart>

        <View className="absolute inset-0 items-center justify-center">
          {selected ? (
            <>
              <Text className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                {selected.country}
              </Text>
              <Text className="text-xs text-gray-600 dark:text-gray-300">
                {selected.formattedTotal}
              </Text>
            </>
          ) : (
            <>
              <Text className="text-xs text-gray-400">Total</Text>
              <Text className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                {formatPhp(total)}
              </Text>
            </>
          )}
        </View>
      </View>

      <View className="flex-1 gap-2">
        {slices.map((s) => (
          <Pressable
            key={s.country}
            onPress={() => onSlicePress(s.country)}
            className="flex-row items-center gap-2"
          >
            <View className="h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} />
            <Text className="flex-1 text-xs text-gray-600 dark:text-gray-300" numberOfLines={1}>
              {s.country}
            </Text>
            <Text className="text-xs font-semibold text-gray-700 dark:text-gray-100">
              {s.percentage}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
});
