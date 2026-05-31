import { Screen } from "@/components/layout/Screen";
import { Dashboard, NewInvoiceFab } from "@/features/dashboard";
import { SimulatePaymentFab } from "@/features/settlement";

export default function DashboardScreen() {
  return (
    <Screen className="p-0">
      <Dashboard />
      <NewInvoiceFab />
      <SimulatePaymentFab />
    </Screen>
  );
}
