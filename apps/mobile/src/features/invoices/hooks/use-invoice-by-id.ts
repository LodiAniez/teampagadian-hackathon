import { api } from "@/lib/api-client";
import type { Invoice } from "@raket/contracts";
import { normalizeError } from "../utils/error";

export function useInvoiceById(invoiceId: string | undefined) {
  const queryKey = ["invoices", invoiceId ?? "missing"];
  const query = api.invoices.getById.useQuery(
    queryKey,
    { params: { invoiceId: invoiceId ?? "" } },
    // queryKey is also required in options under @tanstack/react-query v5 typings,
    // even though ts-rest v4 also accepts it as the first positional argument.
    { queryKey, enabled: Boolean(invoiceId) },
  );

  const invoice: Invoice | null = query.data?.status === 200 ? query.data.body : null;

  return {
    invoice,
    isLoading: query.isLoading,
    error: normalizeError(query.error),
    refetch: query.refetch,
  };
}
