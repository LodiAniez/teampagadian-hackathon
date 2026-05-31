import React, { memo } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useEarningsByCountryChart } from "./use-earnings-by-country-chart";
import { formatPhp } from "@/lib/format";

const SIZE = 160;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R_OUTER = SIZE / 2;
const R_INNER = R_OUTER * 0.6;

function donutArc(start: number, end: number) {
  const largeArc = end - start > Math.PI ? 1 : 0;
  const x1 = CX + R_OUTER * Math.cos(start);
  const y1 = CY + R_OUTER * Math.sin(start);
  const x2 = CX + R_OUTER * Math.cos(end);
  const y2 = CY + R_OUTER * Math.sin(end);
  const x3 = CX + R_INNER * Math.cos(end);
  const y3 = CY + R_INNER * Math.sin(end);
  const x4 = CX + R_INNER * Math.cos(start);
  const y4 = CY + R_INNER * Math.sin(start);
  return `M ${x1} ${y1} A ${R_OUTER} ${R_OUTER} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${R_INNER} ${R_INNER} 0 ${largeArc} 0 ${x4} ${y4} Z`;
}

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
  let cursor = -Math.PI / 2;
  const arcs = slices.map((s) => {
    const sweep = total > 0 ? (s.totalPhp / total) * Math.PI * 2 : 0;
    const arc = { ...s, start: cursor, end: cursor + sweep };
    cursor += sweep;
    return arc;
  });

  return (
    <View className="flex-row items-center gap-4">
      <View style={{ width: SIZE, height: SIZE }} className="relative">
        <Svg width={SIZE} height={SIZE}>
          {arcs.map((a) => (
            <Path
              key={a.country}
              d={donutArc(a.start, a.end)}
              fill={a.color}
              opacity={selected && !a.isSelected ? 0.4 : 1}
              onPress={() => onSlicePress(a.country)}
            />
          ))}
        </Svg>

        <View className="absolute inset-0 items-center justify-center" pointerEvents="none">
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
