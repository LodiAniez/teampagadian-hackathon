import { api } from "@/lib/api-client";
import type { CreateInvoiceBody, Invoice } from "@raket/contracts";

export function useCreateInvoice() {
  const mutation = api.invoices.create.useMutation();

  const created: Invoice | null = mutation.data?.status === 201 ? mutation.data.body : null;

  return {
    save: (body: CreateInvoiceBody) => mutation.mutateAsync({ body }),
    created,
    isSaving: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}
