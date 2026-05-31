import type { InvoiceListItem } from "@raket/contracts";

/**
 * Picks the N most recently created invoices, newest first. The list-items
 * endpoint is the dashboard's source for recent invoices; we sort defensively
 * here so the dashboard doesn't depend on the API's ordering.
 */
export function selectRecentInvoices(items: InvoiceListItem[], limit = 5): InvoiceListItem[] {
  return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}
