import { ScrollView, View, Text } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { Screen } from "@/components/layout/Screen";
import { FxComparisonCard } from "@/features/fx";
import { api } from "@/lib/api-client";

export default function InvoiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const invoiceQuery = api.invoices.getById.useQuery(["invoices", id], {
    params: { invoiceId: id },
  });
  const invoice = invoiceQuery.data?.status === 200 ? invoiceQuery.data.body : undefined;

  return (
    <Screen>
      <Stack.Screen options={{ title: "Invoice" }} />
      <ScrollView contentContainerClassName="gap-4 p-4">
        <View className="gap-1">
          <Text className="text-lg font-semibold text-gray-700">Invoice detail</Text>
          <Text className="text-sm text-gray-400">Coming soon (TEA-52 follow-on)</Text>
        </View>
        {/* Demo invoices are denominated in USD, so the amount maps directly to
            the calculator's usdAmount. Non-USD invoices are out of scope here. */}
        {invoice ? (
          <FxComparisonCard
            usdAmount={invoice.amount}
            country={invoice.client.country ?? undefined}
          />
        ) : null}
      </ScrollView>
    </Screen>
  );
}
