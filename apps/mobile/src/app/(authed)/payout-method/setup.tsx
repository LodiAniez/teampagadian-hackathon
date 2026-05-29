import { Stack, useRouter } from "expo-router";
import { Screen } from "@/components/layout/Screen";
import { SetupForm } from "@/features/payout-method";

export default function PayoutMethodSetupScreen() {
  const router = useRouter();
  return (
    <Screen scroll>
      <Stack.Screen options={{ title: "Payout method", presentation: "modal" }} />
      <SetupForm onSuccess={() => router.replace("/")} />
    </Screen>
  );
}
