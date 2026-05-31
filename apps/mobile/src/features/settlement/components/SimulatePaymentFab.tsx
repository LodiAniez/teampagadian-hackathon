import { Pressable, Text } from "react-native";
import { useSimulatePayment } from "../hooks/use-simulate-payment";

/**
 * Dev-only floating action button that fakes a "money landed" event so the
 * settlement animation can be demoed without a live Stripe webhook. Renders
 * nothing outside dev builds (`__DEV__`), so it never ships to production.
 */
export function SimulatePaymentFab() {
  const { simulate } = useSimulatePayment();

  if (!__DEV__) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Simulate payment"
      onPress={simulate}
      className="absolute bottom-6 right-5 flex-row items-center gap-2 rounded-full bg-gray-900 px-4 py-3 shadow-lg shadow-black/30 active:opacity-80"
    >
      <Text className="text-base">⚡️</Text>
      <Text className="text-sm font-semibold text-white">Simulate payment</Text>
    </Pressable>
  );
}
