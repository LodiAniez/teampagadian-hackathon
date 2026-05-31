import { Pressable, Text } from "react-native";
import { Link } from "expo-router";

/**
 * Primary "New invoice" FAB. Anchored bottom-LEFT: the bottom-right corner is
 * owned by the dev-only SimulatePaymentFab (which we must keep and can't move),
 * so the left corner avoids overlap. `bottom-6` clears the tab bar.
 */
export function NewInvoiceFab() {
  return (
    <Link href="/invoices/new" asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="New invoice"
        className="absolute bottom-6 left-5 flex-row items-center gap-2 rounded-full bg-brand-600 px-5 py-3 shadow-lg shadow-black/30 active:bg-brand-700"
      >
        <Text className="text-base text-white">＋</Text>
        <Text className="text-sm font-semibold text-white">New invoice</Text>
      </Pressable>
    </Link>
  );
}
