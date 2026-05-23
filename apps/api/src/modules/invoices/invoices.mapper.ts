import type { Client, Invoice, InvoiceLineItem, SupportedCurrency } from "@raket/contracts";
import type {
  Client as ClientRow,
  Invoice as InvoiceRow,
  InvoiceLineItem as InvoiceLineItemRow,
} from "@prisma/client";

export type InvoiceRowWithClientAndLineItems = InvoiceRow & {
  client: ClientRow;
  lineItems: InvoiceLineItemRow[];
};

function asSupportedCurrency(currency: string): SupportedCurrency {
  if (currency !== "USD" && currency !== "EUR" && currency !== "GBP" && currency !== "PHP") {
    throw new Error(`Unsupported currency in DB row: ${currency}`);
  }
  return currency;
}

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

export function toClientDto(row: ClientRow): Client {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    email: row.email,
    country: row.country,
    defaultCurrency: asSupportedCurrency(row.defaultCurrency),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toInvoiceDto(row: InvoiceRowWithClientAndLineItems): Invoice {
  return {
    id: row.id,
    clientId: row.clientId,
    client: toClientDto(row.client),
    number: row.number,
    status: row.status,
    amount: Number(row.amount),
    currency: asSupportedCurrency(row.currency),
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
