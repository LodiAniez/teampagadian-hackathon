import React, { memo } from "react";
import { View, Text, ActivityIndicator, useColorScheme } from "react-native";
import { CartesianChart, Bar } from "victory-native";
import { useEarningsBarChart } from "./use-earnings-bar-chart";

export const EarningsBarChart = memo(function EarningsBarChart() {
  const { data, isLoading, error, chartPressState, tooltip } = useEarningsBarChart();
  const isDark = useColorScheme() === "dark";
  const labelColor = isDark ? "#d1fae5" : "#047857";
  const barColor = "#059669";

  if (isLoading) {
    return (
      <View className="h-48 items-center justify-center">
        <ActivityIndicator color={barColor} />
      </View>
    );
  }

  if (error || data.length === 0) {
    return (
      <View className="h-48 items-center justify-center">
        <Text className="text-sm text-gray-400">No data yet</Text>
      </View>
    );
  }

  return (
    <View className="h-48">
      <CartesianChart
        data={data}
        xKey="month"
        yKeys={["amountPhp"]}
        chartPressState={chartPressState}
        axisOptions={{ labelColor, tickCount: { x: data.length, y: 4 } }}
      >
        {({ points, chartBounds }) => (
          <Bar
            points={points.amountPhp}
            chartBounds={chartBounds}
            color={barColor}
            roundedCorners={{ topLeft: 4, topRight: 4 }}
            animate={{ type: "spring", duration: 300 }}
          />
        )}
      </CartesianChart>

      {tooltip && (
        <View
          style={{ position: "absolute", left: tooltip.x - 40, top: tooltip.y - 32 }}
          className="rounded-md bg-emerald-700 px-2 py-1"
          pointerEvents="none"
        >
          <Text className="text-xs font-semibold text-white">{tooltip.label}</Text>
        </View>
      )}
    </View>
  );
});
