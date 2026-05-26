import { api } from "@/lib/api-client";
import type { SendInvoiceResponse } from "@raket/contracts";
import { normalizeError } from "../utils/error";

export function useSendInvoice() {
  const mutation = api.invoices.send.useMutation();

  const result: SendInvoiceResponse | null =
    mutation.data?.status === 200 ? mutation.data.body : null;

  return {
    send: (invoiceId: string, clientEmail: string) =>
      mutation.mutateAsync({ params: { invoiceId }, body: { clientEmail } }),
    result,
    isSending: mutation.isPending,
    error: normalizeError(mutation.error),
  };
}
