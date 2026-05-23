import { View, Text } from "react-native";
import { Stack } from "expo-router";
import { Screen } from "@/components/layout/Screen";

export default function InvoiceSentScreen() {
  return (
    <Screen>
      <Stack.Screen options={{ title: "Payment", presentation: "modal" }} />
      <View className="flex-1 items-center justify-center gap-2">
        <Text className="text-lg font-semibold text-gray-700">Payment received</Text>
        <Text className="text-sm text-gray-400">Coming soon (TEA-45)</Text>
      </View>
    </Screen>
  );
}
