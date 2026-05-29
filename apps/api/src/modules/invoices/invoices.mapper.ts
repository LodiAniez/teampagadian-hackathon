import type {
  Client,
  Invoice,
  InvoiceLineItem,
  InvoiceListItem,
  PublicInvoiceResponse,
  SupportedCurrency,
} from "@raket/contracts";
import type {
  Client as ClientRow,
  Invoice as InvoiceRow,
  InvoiceLineItem as InvoiceLineItemRow,
  Payment as PaymentRow,
  User as UserRow,
} from "@prisma/client";

export type InvoiceRowWithClientAndLineItems = InvoiceRow & {
  client: ClientRow;
  lineItems: InvoiceLineItemRow[];
};

export type InvoiceRowForListItem = InvoiceRow & {
  client: Pick<ClientRow, "id" | "name">;
  payments: Array<Pick<PaymentRow, "amountPhp">>;
};

export type InvoiceRowForPublic = InvoiceRowWithClientAndLineItems & {
  user: UserRow;
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

export function toInvoiceListItem(row: InvoiceRowForListItem): InvoiceListItem {
  return {
    id: row.id,
    number: row.number,
    status: row.status,
    clientName: row.client.name,
    amount: Number(row.amount),
    currency: asSupportedCurrency(row.currency),
    amountPhp: row.payments[0] ? Number(row.payments[0].amountPhp) : null,
    issueDate: isoDate(row.issueDate),
    dueDate: isoDate(row.dueDate),
    createdAt: row.createdAt.toISOString(),
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

// Sanitized public projection: explicitly enumerates exposed fields so a new
// column on Invoice/User/Client doesn't silently leak through a public link.
// Defense-in-depth — don't rely on Prisma `select` alone.
export function toPublicInvoiceDto(row: InvoiceRowForPublic): PublicInvoiceResponse {
  if (row.status !== "sent" && row.status !== "paid") {
    throw new Error(`Invariant: toPublicInvoiceDto called with status ${row.status}`);
  }
  if (!row.publicShareToken) {
    throw new Error("Invariant: toPublicInvoiceDto called on row without publicShareToken");
  }
  const isPaid = row.status === "paid";
  return {
    number: row.number,
    status: row.status,
    amount: Number(row.amount),
    currency: asSupportedCurrency(row.currency),
    issueDate: isoDate(row.issueDate),
    dueDate: isoDate(row.dueDate),
    freelancer: {
      name: row.user.name,
      businessName: row.user.businessName,
    },
    client: {
      name: row.client.name,
    },
    lineItems: row.lineItems
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((li) => ({
        description: li.description,
        quantity: Number(li.quantity),
        unit: li.unit,
        rate: Number(li.rate),
        amount: Number(li.amount),
      })),
    stripeCheckoutUrl: isPaid ? null : row.stripeCheckoutUrl,
    qrCodeDataUrl: isPaid ? null : row.qrCodeDataUrl,
    token: row.publicShareToken,
  };
}
