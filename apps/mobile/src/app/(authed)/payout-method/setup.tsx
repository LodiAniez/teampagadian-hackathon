import { View, Text } from "react-native";
import { Stack } from "expo-router";
import { Screen } from "@/components/layout/Screen";

export default function PayoutMethodSetupScreen() {
  return (
    <Screen scroll>
      <Stack.Screen options={{ title: "Payout method", presentation: "modal" }} />
      <View className="flex-1 items-center justify-center gap-2">
        <Text className="text-lg font-semibold text-gray-700">Payout method</Text>
        <Text className="text-sm text-gray-400">Coming soon</Text>
      </View>
    </Screen>
  );
}
