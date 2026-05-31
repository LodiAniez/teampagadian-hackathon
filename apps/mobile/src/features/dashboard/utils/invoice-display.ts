import type { InvoiceListItem, InvoiceStatus } from "@raket/contracts";
import { formatMoney } from "@/lib/format";

export type InvoiceStatusTone = "paid" | "pending" | "overdue" | "draft" | "void";

const STATUS_DISPLAY: Record<InvoiceStatus, { label: string; tone: InvoiceStatusTone }> = {
  paid: { label: "Paid", tone: "paid" },
  sent: { label: "Pending", tone: "pending" },
  overdue: { label: "Overdue", tone: "overdue" },
  draft: { label: "Draft", tone: "draft" },
  void: { label: "Void", tone: "void" },
};

export function describeInvoiceStatus(status: InvoiceStatus): {
  label: string;
  tone: InvoiceStatusTone;
} {
  return STATUS_DISPLAY[status];
}

export function formatInvoiceAmount(item: Pick<InvoiceListItem, "amount" | "currency">): string {
  return formatMoney(item.amount, item.currency);
}
