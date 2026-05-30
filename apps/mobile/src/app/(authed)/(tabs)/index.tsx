import { View, Text } from "react-native";
import { Stack } from "expo-router";
import { Screen } from "@/components/layout/Screen";
import { SimulatePaymentFab } from "@/features/settlement";

export default function DashboardScreen() {
  return (
    <Screen>
      <Stack.Screen options={{ title: "Dashboard" }} />
      <View className="flex-1 items-center justify-center gap-2">
        <Text className="text-lg font-semibold text-gray-700">Dashboard</Text>
        <Text className="text-sm text-gray-400">Coming soon (TEA-49)</Text>
      </View>
      <SimulatePaymentFab />
    </Screen>
  );
}
