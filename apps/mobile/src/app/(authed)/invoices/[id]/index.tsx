import { View, Text } from "react-native";
import { Stack } from "expo-router";
import { Screen } from "@/components/layout/Screen";

export default function InvoiceDetailScreen() {
  return (
    <Screen>
      <Stack.Screen options={{ title: "Invoice" }} />
      <View className="flex-1 items-center justify-center gap-2">
        <Text className="text-lg font-semibold text-gray-700">Invoice detail</Text>
        <Text className="text-sm text-gray-400">Coming soon (TEA-52 follow-on)</Text>
      </View>
    </Screen>
  );
}
