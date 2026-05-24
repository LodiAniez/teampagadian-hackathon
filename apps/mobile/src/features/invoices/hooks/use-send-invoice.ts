import { api } from "@/lib/api-client";
import type { SendInvoiceBody, SendInvoiceResponse } from "@raket/contracts";
import { normalizeError } from "../utils/error";

export function useSendInvoice(invoiceId: string | undefined) {
  const mutation = api.invoices.send.useMutation();

  const result: SendInvoiceResponse | null =
    mutation.data?.status === 200 ? mutation.data.body : null;

  return {
    send: async (body: SendInvoiceBody) => {
      if (!invoiceId) return null;
      try {
        return await mutation.mutateAsync({ params: { invoiceId }, body });
      } catch {
        // mutateAsync rejects on 4xx/5xx; surface via mutation.error instead of bubbling.
        return null;
      }
    },
    result,
    isSending: mutation.isPending,
    error: normalizeError(mutation.error),
    reset: mutation.reset,
  };
}
