import { api } from "@/lib/api-client";
import type { SendInvoiceBody, SendInvoiceResponse } from "@raket/contracts";
import { normalizeError, type NormalizedError } from "../utils/error";

type SendResult = { ok: true; data: SendInvoiceResponse } | { ok: false; error: NormalizedError };

export function useSendInvoice(invoiceId: string | undefined) {
  const mutation = api.invoices.send.useMutation();

  const result: SendInvoiceResponse | null =
    mutation.data?.status === 200 ? mutation.data.body : null;

  return {
    send: async (body: SendInvoiceBody): Promise<SendResult> => {
      if (!invoiceId) return { ok: false, error: { message: "No invoice id" } };
      try {
        const res = await mutation.mutateAsync({ params: { invoiceId }, body });
        return { ok: true, data: res.body as SendInvoiceResponse };
      } catch (err) {
        return { ok: false, error: normalizeError(err) ?? { message: "Request failed" } };
      }
    },
    result,
    isSending: mutation.isPending,
    error: normalizeError(mutation.error),
    reset: mutation.reset,
  };
}
