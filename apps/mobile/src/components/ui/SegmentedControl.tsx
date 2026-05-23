import { Pressable, Text, View, type ViewProps } from "react-native";
import { cn } from "@/lib/cn";

export type SegmentedControlOption<V extends string> = {
  value: V;
  label: string;
};

export type SegmentedControlProps<V extends string> = {
  options: ReadonlyArray<SegmentedControlOption<V>>;
  value: V;
  onChange: (value: V) => void;
  className?: ViewProps["className"];
};

/**
 * Pill-shaped tab control. Pure: caller owns selection state.
 *
 * Usage:
 *   <SegmentedControl
 *     options={[{ value: "text", label: "Text" }, { value: "manual", label: "Manual" }]}
 *     value={mode}
 *     onChange={setMode}
 *   />
 */
export function SegmentedControl<V extends string>({
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<V>) {
  return (
    <View
      accessibilityRole="tablist"
      className={cn("flex-row gap-1 rounded-xl border border-gray-200 bg-gray-100 p-1", className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            className={cn(
              "flex-1 items-center justify-center rounded-lg py-2",
              active && "bg-white shadow-sm shadow-black/5",
            )}
          >
            <Text
              className={cn("text-sm font-semibold", active ? "text-gray-900" : "text-gray-500")}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
