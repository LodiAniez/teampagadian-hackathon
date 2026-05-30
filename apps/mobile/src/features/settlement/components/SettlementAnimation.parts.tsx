import { useEffect, useMemo } from "react";
import { Text, View } from "react-native";
import { Canvas, Group, Path, Skia } from "@shopify/react-native-skia";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { cn } from "@/lib/cn";

const RING_SIZE = 120;
const RING_STROKE = 10;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;

// Brand-700 track / brand-600 → gold-500 arc, mirroring the mock's conic ring.
const TRACK_COLOR = "rgba(4, 120, 87, 0.12)";
const ARC_COLOR = "#059669";
const ARC_COLOR_DONE = "#f59e0b";

/**
 * Circular progress arc drawn with Skia. A full-circle path is trimmed via the
 * `end` prop (0..1) — a Reanimated shared value Skia reads natively — and the
 * group is rotated -90° so the sweep starts at 12 o'clock, matching
 * `settlement-animation.html`'s conic ring.
 */
export function ProgressRing({ progress, progressPct }: { progress: number; progressPct: number }) {
  const end = useSharedValue(0);

  useEffect(() => {
    end.value = withTiming(progress, { duration: 400 });
  }, [progress, end]);

  const ringPath = useMemo(() => {
    const path = Skia.Path.Make();
    path.addCircle(RING_SIZE / 2, RING_SIZE / 2, RING_RADIUS);
    return path;
  }, []);

  const done = progressPct >= 100;

  return (
    <View className="items-center justify-center" style={{ width: RING_SIZE, height: RING_SIZE }}>
      <Canvas style={{ width: RING_SIZE, height: RING_SIZE }}>
        <Group
          transform={[{ rotate: -Math.PI / 2 }]}
          origin={{ x: RING_SIZE / 2, y: RING_SIZE / 2 }}
        >
          <Path
            path={ringPath}
            style="stroke"
            strokeWidth={RING_STROKE}
            strokeCap="round"
            color={TRACK_COLOR}
          />
          <Path
            path={ringPath}
            style="stroke"
            strokeWidth={RING_STROKE}
            strokeCap="round"
            color={done ? ARC_COLOR_DONE : ARC_COLOR}
            start={0}
            end={end}
          />
        </Group>
      </Canvas>
      <View className="absolute inset-0 items-center justify-center">
        <Text className="text-3xl font-bold tabular-nums text-gray-900">{progressPct}%</Text>
      </View>
    </View>
  );
}

type StepState = "pending" | "active" | "done";

/** One row in the settlement timeline. Pure — colour reflects the step's state. */
export function StepRow({
  title,
  meta,
  state,
  isLast,
}: {
  title: string;
  meta: string;
  state: StepState;
  isLast: boolean;
}) {
  return (
    <View className={cn("flex-row items-center gap-3 py-3", !isLast && "border-b border-gray-100")}>
      <View
        className={cn(
          "h-8 w-8 items-center justify-center rounded-full",
          state === "done" && "bg-brand-600",
          state === "active" && "bg-brand-100",
          state === "pending" && "bg-gray-100",
        )}
      >
        <Text
          className={cn(
            "text-xs font-bold",
            state === "done"
              ? "text-white"
              : state === "active"
                ? "text-brand-700"
                : "text-gray-400",
          )}
        >
          {state === "done" ? "✓" : "•"}
        </Text>
      </View>
      <View className="flex-1">
        <Text
          className={cn(
            "text-sm font-semibold",
            state === "pending" ? "text-gray-400" : "text-gray-900",
          )}
        >
          {title}
        </Text>
        <Text className="text-xs text-gray-400">{meta}</Text>
      </View>
    </View>
  );
}

/** The "money landed" toast that slides up from the bottom once delivered. */
export function LiveToast({ visible, message }: { visible: boolean; message: string }) {
  const offset = useSharedValue(20);
  const opacity = useSharedValue(0);

  useEffect(() => {
    offset.value = withSpring(visible ? 0 : 20, { damping: 18 });
    opacity.value = withTiming(visible ? 1 : 0, { duration: 300 });
  }, [visible, offset, opacity]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: offset.value }],
  }));

  return (
    <Animated.View
      pointerEvents={visible ? "auto" : "none"}
      style={style}
      className="absolute bottom-7 left-5 right-5 flex-row items-center gap-3 rounded-2xl bg-gray-900 px-4 py-4 shadow-xl shadow-black/40"
    >
      <View className="h-8 w-8 items-center justify-center rounded-full bg-brand-500">
        <Text className="text-base font-bold text-white">✓</Text>
      </View>
      <Text className="flex-1 text-sm font-semibold text-white">{message}</Text>
    </Animated.View>
  );
}
