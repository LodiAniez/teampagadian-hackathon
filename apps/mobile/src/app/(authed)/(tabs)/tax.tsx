import { View, Text } from "react-native";
import { Stack } from "expo-router";
import { Screen } from "@/components/layout/Screen";

export default function TaxScreen() {
  return (
    <Screen>
      <Stack.Screen options={{ title: "Tax" }} />
      <View className="flex-1 items-center justify-center gap-2">
        <Text className="text-lg font-semibold text-gray-700">Tax</Text>
        <Text className="text-sm text-gray-400">Coming soon</Text>
      </View>
    </Screen>
  );
}
