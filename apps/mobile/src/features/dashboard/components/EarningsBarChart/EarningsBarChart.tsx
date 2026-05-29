import React, { memo } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import Svg, { Rect, G, Text as SvgText } from "react-native-svg";
import { useEarningsBarChart } from "./use-earnings-bar-chart";

const W = 320;
const H = 180;
const PAD_X = 24;
const PAD_TOP = 8;
const PAD_BOTTOM = 24;

export const EarningsBarChart = memo(function EarningsBarChart() {
  const { data, max, isLoading, error, selectedIndex, onSelect } = useEarningsBarChart();

  if (isLoading) {
    return (
      <View className="h-48 items-center justify-center">
        <ActivityIndicator color="#059669" />
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

  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_TOP - PAD_BOTTOM;
  const slotW = innerW / data.length;
  const barW = slotW * 0.6;
  const selected = selectedIndex !== null ? data[selectedIndex] : null;

  return (
    <View>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        {data.map((d, i) => {
          const h = (d.amountPhp / max) * innerH;
          const x = PAD_X + slotW * i + (slotW - barW) / 2;
          const y = PAD_TOP + innerH - h;
          const isSel = selectedIndex === i;
          return (
            <G key={d.month}>
              <Rect
                x={x}
                y={y}
                width={barW}
                height={h}
                rx={4}
                fill={isSel ? "#047857" : "#059669"}
                onPress={() => onSelect(isSel ? null : i)}
              />
              <SvgText x={x + barW / 2} y={H - 6} fontSize={11} fill="#6b7280" textAnchor="middle">
                {d.month}
              </SvgText>
            </G>
          );
        })}
      </Svg>

      {selected && (
        <View className="mt-2 self-center rounded-md bg-emerald-700 px-3 py-1">
          <Text className="text-xs font-semibold text-white">
            {selected.month}: {selected.formattedAmount}
          </Text>
        </View>
      )}
    </View>
  );
});
