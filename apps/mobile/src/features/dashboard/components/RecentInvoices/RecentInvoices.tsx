import { View, Text } from "react-native";
import { Link } from "expo-router";
import type { InvoiceListItem } from "@raket/contracts";
import { Card } from "@/components/ui";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  describeInvoiceStatus,
  formatInvoiceAmount,
  type InvoiceStatusTone,
} from "../../utils/invoice-display";

type Props = {
  invoices: InvoiceListItem[];
  isLoading: boolean;
};

const TONE_CLASS: Record<InvoiceStatusTone, string> = {
  paid: "bg-brand-50 text-brand-700",
  pending: "bg-amber-50 text-amber-700",
  overdue: "bg-red-50 text-red-600",
  draft: "bg-gray-100 text-gray-600",
  void: "bg-gray-100 text-gray-400",
};

/**
 * The 5 most recent invoices (paid + pending mixed). Rendered as a plain mapped
 * list — never a FlatList nested in the dashboard ScrollView — to keep scroll
 * smooth.
 */
export function RecentInvoices({ invoices, isLoading }: Props) {
  return (
    <View className="gap-2">
      <Text className="text-base font-semibold text-gray-900">Recent invoices</Text>
      <Card className="gap-0 p-0">
        {isLoading ? (
          <View className="gap-3 p-4">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-3/4" />
          </View>
        ) : invoices.length === 0 ? (
          <Text className="p-4 text-sm text-gray-400">No invoices yet</Text>
        ) : (
          invoices.map((invoice, i) => (
            <InvoiceRow key={invoice.id} invoice={invoice} isFirst={i === 0} />
          ))
        )}
      </Card>
    </View>
  );
}

function InvoiceRow({ invoice, isFirst }: { invoice: InvoiceListItem; isFirst: boolean }) {
  const status = describeInvoiceStatus(invoice.status);
  return (
    <Link href={`/invoices/${invoice.id}`} asChild>
      <View
        className={`flex-row items-center justify-between px-4 py-3 ${
          isFirst ? "" : "border-t border-gray-100"
        }`}
      >
        <View className="flex-1 pr-3">
          <Text className="text-sm font-semibold text-gray-900" numberOfLines={1}>
            {invoice.number}
          </Text>
          <Text className="text-xs text-gray-500" numberOfLines={1}>
            {invoice.clientName}
          </Text>
        </View>
        <View className="items-end gap-1">
          <Text className="text-sm font-semibold text-gray-900">
            {formatInvoiceAmount(invoice)}
          </Text>
          <View className={`rounded-full px-2 py-0.5 ${TONE_CLASS[status.tone].split(" ")[0]}`}>
            <Text className={`text-[11px] font-medium ${TONE_CLASS[status.tone].split(" ")[1]}`}>
              {status.label}
            </Text>
          </View>
        </View>
      </View>
    </Link>
  );
}
