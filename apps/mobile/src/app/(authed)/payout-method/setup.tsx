import { Stack } from "expo-router";
import { Screen } from "@/components/layout/Screen";
import { PayoutMethodSetup } from "@/features/payout-method";

export default function PayoutMethodSetupScreen() {
  return (
    <Screen>
      <Stack.Screen options={{ title: "Payout method", presentation: "modal" }} />
      <PayoutMethodSetup />
    </Screen>
  );
}
