import type {
  CreateInvoiceBody,
  CreateInvoiceLineItem,
  InvoiceSourceType,
  ParsedInvoiceDraft,
} from "@raket/contracts";

const DEFAULT_DUE_DATE_OFFSET_DAYS = 14;
const DEFAULT_UNIT = "hours";
const DEFAULT_QUANTITY = 1;
const DEFAULT_RATE = 0;

export type InvoiceFormValues = CreateInvoiceBody;

export function emptyLineItem(): CreateInvoiceLineItem {
  return {
    description: "",
    quantity: DEFAULT_QUANTITY,
    unit: DEFAULT_UNIT,
    rate: DEFAULT_RATE,
  };
}

export function emptyFormValues(
  sourceType: InvoiceSourceType = "text",
  today: Date = new Date(),
): Partial<InvoiceFormValues> {
  const issueDate = toISODate(today);
  return {
    currency: "USD",
    issueDate,
    dueDate: addDaysISO(issueDate, DEFAULT_DUE_DATE_OFFSET_DAYS),
    sourceType,
    lineItems: [emptyLineItem()],
  };
}

export function mapDraftToFormValues(
  draft: ParsedInvoiceDraft,
  sourceType: InvoiceSourceType = "text",
): Partial<InvoiceFormValues> {
  const lineItems: CreateInvoiceLineItem[] =
    draft.lineItems.length === 0
      ? [emptyLineItem()]
      : draft.lineItems.map((item) => ({
          description: item.description,
          quantity: item.quantity ?? DEFAULT_QUANTITY,
          unit: item.unit ?? "",
          rate: item.rate ?? DEFAULT_RATE,
        }));

  const issueDate = isValidIsoDate(draft.issueDate) ? draft.issueDate : toISODate(new Date());

  return {
    clientName: draft.clientName ?? undefined,
    clientEmail: draft.clientEmail ?? undefined,
    currency: draft.currency,
    issueDate,
    dueDate: draft.dueDate ?? addDaysISO(issueDate, DEFAULT_DUE_DATE_OFFSET_DAYS),
    sourceType,
    lineItems,
  };
}

export function computeLineTotal(item: Pick<CreateInvoiceLineItem, "quantity" | "rate">): number {
  return (Number(item.quantity) || 0) * (Number(item.rate) || 0);
}

export function computeInvoiceTotal(lineItems: ReadonlyArray<CreateInvoiceLineItem>): number {
  return lineItems.reduce((sum, item) => sum + computeLineTotal(item), 0);
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  return !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
}

function addDaysISO(isoDate: string, days: number): string {
  const base = isValidIsoDate(isoDate) ? new Date(`${isoDate}T00:00:00Z`) : new Date();
  base.setUTCDate(base.getUTCDate() + days);
  return toISODate(base);
}
