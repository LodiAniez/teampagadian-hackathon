import { useCallback } from "react";
import { api } from "@/lib/api-client";
import type { SendInvoiceResponse } from "@raket/contracts";
import { normalizeError } from "../utils/error";

export function useSendInvoice() {
  const mutation = api.invoices.send.useMutation();
  const { mutateAsync } = mutation;

  const result: SendInvoiceResponse | null =
    mutation.data?.status === 200 ? mutation.data.body : null;

  // Stable reference so consumers can safely include `send` in effect deps
  // without scheduling the effect on every render.
  const send = useCallback(
    (invoiceId: string, clientEmail: string) =>
      mutateAsync({ params: { invoiceId }, body: { clientEmail } }),
    [mutateAsync],
  );

  return {
    send,
    result,
    isSending: mutation.isPending,
    error: normalizeError(mutation.error),
  };
}
