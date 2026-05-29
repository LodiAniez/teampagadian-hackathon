import { Pressable, StyleSheet, Text, View, type ViewProps } from "react-native";
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

// Active-state background + shadow live in inline styles, not className.
// NativeWind v4 treats shadow-* as an "animatable" upgrade — toggling those
// classes after the initial render triggers a console warning that internally
// JSON.stringify-walks the props (and, via React's _owner chain, the React
// Navigation context default), which throws "Couldn't find a navigation
// context". Keeping the className stable across active/inactive avoids the
// upgrade path entirely.
const ACTIVE_TAB_STYLE = {
  backgroundColor: "#ffffff",
  ...StyleSheet.flatten({
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  }),
};

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
            className="flex-1 items-center justify-center rounded-lg py-2"
            style={active ? ACTIVE_TAB_STYLE : undefined}
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
