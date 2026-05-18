import type { Invoice, InvoiceLineItem } from "@raket/contracts";
import type {
  Invoice as InvoiceRow,
  InvoiceLineItem as InvoiceLineItemRow,
} from "@prisma/client";

export type InvoiceRowWithLineItems = InvoiceRow & {
  lineItems: InvoiceLineItemRow[];
};

function toLineItemDto(row: InvoiceLineItemRow): InvoiceLineItem {
  return {
    id: row.id,
    description: row.description,
    quantity: Number(row.quantity),
    unit: row.unit,
    rate: Number(row.rate),
    amount: Number(row.amount),
  };
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function toInvoiceDto(row: InvoiceRowWithLineItems): Invoice {
  const currency = row.currency;
  if (currency !== "USD" && currency !== "EUR" && currency !== "GBP" && currency !== "PHP") {
    throw new Error(`Unsupported currency in DB row: ${currency}`);
  }

  return {
    id: row.id,
    clientId: row.clientId,
    status: row.status,
    amount: Number(row.amount),
    currency,
    issueDate: isoDate(row.issueDate),
    dueDate: isoDate(row.dueDate),
    sourceType: row.sourceType,
    stripePaymentIntentId: row.stripePaymentIntentId,
    lineItems: row.lineItems
      .slice()
      .sort((a, b) => a.position - b.position)
      .map(toLineItemDto),
    createdAt: row.createdAt.toISOString(),
  };
}
