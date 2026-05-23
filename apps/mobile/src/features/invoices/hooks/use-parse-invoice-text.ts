import { api } from "@/lib/api-client";
import type { ParsedInvoiceDraft, SupportedCurrency } from "@raket/contracts";

export type ParseInvoiceTextInput = {
  text: string;
  defaultCurrency?: SupportedCurrency;
};

export function useParseInvoiceText() {
  const mutation = api.invoices.parseText.useMutation();

  const successDraft: ParsedInvoiceDraft | null =
    mutation.data?.status === 200 ? mutation.data.body : null;

  return {
    parse: (input: ParseInvoiceTextInput) => mutation.mutateAsync({ body: input }),
    draft: successDraft,
    warnings: successDraft?.warnings ?? [],
    isParsing: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}
