import { Stack } from "expo-router";
import { Screen } from "@/components/layout/Screen";
import { InvoiceForm } from "@/features/invoices";

export default function NewInvoiceScreen() {
  return (
    <Screen scroll className="p-0">
      <Stack.Screen options={{ title: "New invoice", presentation: "modal" }} />
      <InvoiceForm />
    </Screen>
  );
}
