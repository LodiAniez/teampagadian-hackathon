import { api } from "@/lib/api-client";
import { selectRecentInvoices } from "../utils/recent-invoices";

const DEFAULT_LIMIT = 5;

/**
 * Fetches the slim invoice projection (`GET /invoices/list-items`) for the
 * dashboard's "recent invoices" section and trims it to the N newest.
 */
export function useRecentInvoices(limit = DEFAULT_LIMIT) {
  const query = api.invoices.listItems.useQuery(["dashboard", "recent-invoices", limit], {
    query: { limit },
  });
  const invoices =
    query.data?.status === 200 ? selectRecentInvoices(query.data.body.data, limit) : [];

  return {
    invoices,
    isLoading: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
  };
}
