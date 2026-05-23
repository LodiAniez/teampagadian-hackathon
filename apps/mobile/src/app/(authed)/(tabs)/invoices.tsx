import { View, Text } from "react-native";
import { Link, Stack } from "expo-router";
import { Screen } from "@/components/layout/Screen";
import { Button } from "@/components/ui/Button";

export default function InvoicesScreen() {
  return (
    <Screen>
      <Stack.Screen options={{ title: "Invoices" }} />
      <View className="flex-1 items-center justify-center gap-3">
        <Text className="text-lg font-semibold text-gray-700">Invoices</Text>
        <Text className="text-sm text-gray-400">List coming soon (TEA-52)</Text>
        <Link href="/invoices/new" asChild>
          <Button variant="primary" size="md">
            ＋ New invoice
          </Button>
        </Link>
      </View>
    </Screen>
  );
}
