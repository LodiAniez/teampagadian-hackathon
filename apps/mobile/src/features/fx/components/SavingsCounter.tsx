import { useEffect, useState } from "react";
import { Text } from "react-native";
import { runOnJS, useDerivedValue, useSharedValue, withTiming } from "react-native-reanimated";
import { formatPhp } from "@/lib/format";

const DURATION_MS = 1200;

/**
 * Counts up from 0 to `value` once on mount over 1.2s. The shared value is
 * animated on the UI thread; we mirror it to React state via runOnJS so the
 * displayed number can be formatted with Intl (not available inside a worklet).
 * Driving 0 -> target in a mount effect keyed on `value` means it plays exactly
 * once per mount with no reset/flicker.
 */
export function SavingsCounter({ value }: { value: number }) {
  const progress = useSharedValue(0);
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(value, { duration: DURATION_MS });
  }, [value, progress]);

  useDerivedValue(() => {
    runOnJS(setDisplayValue)(progress.value);
  });

  return (
    <Text className="text-3xl font-bold text-emerald-700" numberOfLines={1} adjustsFontSizeToFit>
      {formatPhp(displayValue)}
    </Text>
  );
}
