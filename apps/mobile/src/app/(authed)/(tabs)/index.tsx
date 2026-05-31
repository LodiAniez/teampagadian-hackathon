import { ScrollView, View, Text } from "react-native";
import { Stack } from "expo-router";
import { Screen } from "@/components/layout/Screen";
import { SimulatePaymentFab } from "@/features/settlement";
import { FxComparisonCard } from "@/features/fx";

// $1000 is a representative amount for the pitch; the dashboard has no single
// "current invoice" to key off, so we show the savings story on a round figure.
const DASHBOARD_FX_DEMO_USD = 1000;

export default function DashboardScreen() {
  return (
    <Screen>
      <Stack.Screen options={{ title: "Dashboard" }} />
      <ScrollView contentContainerClassName="gap-4 p-4">
        <View className="gap-1">
          <Text className="text-lg font-semibold text-gray-700">Dashboard</Text>
          <Text className="text-sm text-gray-400">Coming soon (TEA-49)</Text>
        </View>
        <FxComparisonCard usdAmount={DASHBOARD_FX_DEMO_USD} />
      </ScrollView>
      <SimulatePaymentFab />
    </Screen>
  );
}
