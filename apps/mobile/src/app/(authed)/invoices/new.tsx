import { View, Text } from "react-native";
import { Stack } from "expo-router";
import { Screen } from "@/components/layout/Screen";

export default function NewInvoiceScreen() {
  return (
    <Screen scroll>
      <Stack.Screen options={{ title: "New invoice", presentation: "modal" }} />
      <View className="flex-1 items-center justify-center gap-2">
        <Text className="text-lg font-semibold text-gray-700">New invoice</Text>
        <Text className="text-sm text-gray-400">Coming soon (TEA-32)</Text>
      </View>
    </Screen>
  );
}
