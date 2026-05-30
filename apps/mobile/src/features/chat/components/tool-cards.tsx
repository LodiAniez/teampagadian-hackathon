import type {
  ClientSummaryResult,
  EarningsResult,
  InvoiceStatusResult,
  TaxComputation,
} from "@raket/contracts";
import { View, Text } from "react-native";
import { formatDate, formatMoney, formatPhp } from "@/lib/format";
import { parseToolResult, type ParsedToolResult } from "../lib/tool-result";

// Renders a structured card for a tool output, validating it against the
// contract first. Unknown/invalid outputs render nothing (the assistant's text
// still carries the answer).
export function ToolResultCard({ toolName, output }: { toolName: string; output: unknown }) {
  const parsed = parseToolResult(toolName, output);
  if (!parsed) return null;
  return <CardForResult result={parsed} />;
}

function CardForResult({ result }: { result: ParsedToolResult }) {
  switch (result.tool) {
    case "query_earnings":
      return <EarningsCard data={result.data} />;
    case "get_invoice_status":
      return <InvoiceStatusCard data={result.data} />;
    case "calculate_tax_estimate":
      return <TaxEstimateCard data={result.data} />;
    case "get_client_summary":
      return <ClientSummaryCard data={result.data} />;
  }
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mt-2 rounded-xl border border-gray-200 bg-white p-3">
      <Text className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        {title}
      </Text>
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between py-0.5">
      <Text className="text-sm text-gray-500">{label}</Text>
      <Text className="text-sm font-semibold text-gray-900">{value}</Text>
    </View>
  );
}

function EarningsCard({ data }: { data: EarningsResult }) {
  return (
    <Card title="Earnings">
      <Row label="Total" value={formatPhp(data.totalPhp)} />
      <Row label="Invoices" value={String(data.invoiceCount)} />
      {data.rows.length > 0 && (
        <View className="mt-2 border-t border-gray-100 pt-2">
          {data.rows.slice(0, 5).map((row) => (
            <Row key={row.label} label={row.label} value={formatPhp(row.amountPhp)} />
          ))}
        </View>
      )}
    </Card>
  );
}

function InvoiceStatusCard({ data }: { data: InvoiceStatusResult }) {
  return (
    <Card title={`Invoices (${data.count})`}>
      {data.invoices.length === 0 ? (
        <Text className="text-sm text-gray-500">No matching invoices.</Text>
      ) : (
        data.invoices.slice(0, 5).map((inv) => (
          <View key={inv.id} className="flex-row items-center justify-between py-1">
            <View className="flex-1 pr-2">
              <Text className="text-sm font-medium text-gray-900">{inv.clientName}</Text>
              <Text className="text-xs text-gray-400">
                {inv.number} · due {formatDate(inv.dueDate)}
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-sm font-semibold text-gray-900">
                {formatMoney(inv.amount, inv.currency)}
              </Text>
              <StatusBadge status={inv.status} />
            </View>
          </View>
        ))
      )}
    </Card>
  );
}

const STATUS_STYLES: Record<string, string> = {
  paid: "text-emerald-700",
  sent: "text-blue-600",
  overdue: "text-red-600",
  draft: "text-gray-500",
  void: "text-gray-400",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <Text
      className={`text-[11px] font-semibold uppercase ${STATUS_STYLES[status] ?? "text-gray-500"}`}
    >
      {status}
    </Text>
  );
}

function TaxEstimateCard({ data }: { data: TaxComputation }) {
  return (
    <Card title={`Tax estimate · ${data.formCode}`}>
      <Row label="Gross receipts" value={formatPhp(data.grossReceiptsPhp)} />
      <Row label="Estimated tax due" value={formatPhp(data.taxDuePhp)} />
      <Row label="Election" value={data.election === "EIGHT_PERCENT" ? "8% flat" : "Graduated"} />
      <Row label="Deadline" value={formatDate(data.deadline)} />
      <Text className="mt-2 border-t border-gray-100 pt-2 text-xs text-gray-400">
        {data.breakdown}
      </Text>
    </Card>
  );
}

function ClientSummaryCard({ data }: { data: ClientSummaryResult | null }) {
  if (!data) {
    return (
      <Card title="Client">
        <Text className="text-sm text-gray-500">No paid client to summarize yet.</Text>
      </Card>
    );
  }
  return (
    <Card title="Client">
      <Text className="mb-1 text-base font-bold text-gray-900">{data.name}</Text>
      <Row label="Total earned" value={formatPhp(data.totalEarnedPhp)} />
      <Row label="Invoices" value={String(data.invoiceCount)} />
      <Row label="Avg invoice" value={formatPhp(data.averageInvoicePhp)} />
      {data.lastPaidDate && <Row label="Last paid" value={formatDate(data.lastPaidDate)} />}
      {data.country && <Row label="Country" value={data.country} />}
    </Card>
  );
}
