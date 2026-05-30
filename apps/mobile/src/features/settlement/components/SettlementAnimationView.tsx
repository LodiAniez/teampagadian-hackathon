import { View, Text } from "react-native";
import { Button } from "@/components/ui";
import { LiveToast, ProgressRing, StepRow } from "./SettlementAnimation.parts";
import type { SettlementAnimationVm } from "../hooks/use-settlement-animation";

type Props = SettlementAnimationVm & { onDone: () => void };

/** Pure render of the settlement-animation screen. All motion/logic comes via props. */
export function SettlementAnimationView({
  steps,
  heroTitle,
  heroSub,
  progress,
  progressPct,
  isDone,
  toastVisible,
  toastMessage,
  onDone,
}: Props) {
  return (
    <View className="flex-1 px-5 pt-6">
      <View className="items-center pb-4">
        <ProgressRing progress={progress} progressPct={progressPct} />
        <Text className="mt-4 text-center text-xl font-bold text-gray-900">{heroTitle}</Text>
        <Text className="mt-1 text-center text-sm text-gray-400">{heroSub}</Text>
      </View>

      <View className="rounded-2xl border border-gray-100 bg-white px-4">
        {steps.map((step, i) => (
          <StepRow
            key={step.title + i}
            title={step.title}
            meta={step.meta}
            state={step.state}
            isLast={i === steps.length - 1}
          />
        ))}
      </View>

      {isDone ? (
        <Button className="mt-5" fullWidth onPress={onDone}>
          View on dashboard
        </Button>
      ) : null}

      <LiveToast visible={toastVisible} message={toastMessage} />
    </View>
  );
}
