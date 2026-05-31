import { useMemo } from "react";
import { Stack, useLocalSearchParams } from "expo-router";
import { Screen } from "@/components/layout/Screen";
import { SettlementAnimation, parseSettlementParams } from "@/features/settlement";

export default function SettlementScreen() {
  const params = useLocalSearchParams<{
    payoutId?: string;
    amountPhp?: string;
    clientName?: string;
  }>();

  // Freeze the event for this screen instance so the animation doesn't restart
  // if Expo Router re-emits params.
  const event = useMemo(() => parseSettlementParams(params), [params.payoutId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Screen>
      <Stack.Screen options={{ title: "Settling", headerShown: false, gestureEnabled: false }} />
      <SettlementAnimation event={event} />
    </Screen>
  );
}
