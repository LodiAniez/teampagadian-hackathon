import { View, Text } from "react-native";
import { Link } from "expo-router";
import { Card, Button } from "@/components/ui";

/**
 * First-run state for users with no earnings or invoices yet. Points them at
 * the one action that matters: sending their first invoice.
 */
export function DashboardEmptyState() {
  return (
    <Card className="items-center gap-3 py-8">
      <Text className="text-4xl">🧾</Text>
      <Text className="text-base font-semibold text-gray-900">No invoices yet</Text>
      <Text className="px-6 text-center text-sm text-gray-500">
        Send your first invoice to start tracking earnings and savings.
      </Text>
      <Link href="/invoices/new" asChild>
        <Button variant="primary" size="md">
          Send your first invoice
        </Button>
      </Link>
    </Card>
  );
}
