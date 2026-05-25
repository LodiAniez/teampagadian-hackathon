import { Stack, useLocalSearchParams } from "expo-router";
import { Screen } from "@/components/layout/Screen";
import { InvoiceSent } from "@/features/invoices";

export default function InvoiceSentScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  return (
    <Screen scroll>
      <Stack.Screen options={{ title: "Share invoice", presentation: "modal" }} />
      <InvoiceSent invoiceId={params.id} />
    </Screen>
  );
}
