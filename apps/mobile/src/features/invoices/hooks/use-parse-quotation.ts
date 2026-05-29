import { useMutation } from "@tanstack/react-query";
import {
  ParsedInvoiceDraftSchema,
  type ParsedInvoiceDraft,
  type SupportedCurrency,
} from "@raket/contracts";
import { authHeader } from "@/lib/auth";
import { env } from "@/lib/env";
import { normalizeError } from "@/lib/error";
import { appendFile, postMultipart, type RnFile } from "@/lib/form-data";
import { ParseQuotationError } from "./parse-quotation-error";

export { ParseQuotationError };

export type ParseQuotationInput = {
  file: RnFile;
  defaultCurrency?: SupportedCurrency;
};

// Pure request function — exported separately from the hook so it's testable in
// the mobile Vitest env (which has no jsdom / RN renderer for renderHook).
export async function parseQuotationRequest({
  file,
  defaultCurrency,
}: ParseQuotationInput): Promise<ParsedInvoiceDraft> {
  const form = new FormData();
  appendFile(form, "file", file);
  if (defaultCurrency) form.append("defaultCurrency", defaultCurrency);

  const { authorization } = await authHeader();

  // Intentionally do not set Content-Type — XHR.send(FormData) writes the
  // multipart boundary header itself. Manually setting it breaks the boundary
  // and the server can't parse the file part.
  // TODO(TEA-82): pull the URL from the contract. `contract.invoices.parseQuotation.path`
  // is only the leaf ("/parse-quotation"); the root + invoices pathPrefixes
  // ("/api/v1" + "/invoices") live in initContract config and ts-rest doesn't
  // expose them as concatenated strings on the merged router. Either re-export
  // the prefixes as named consts from @raket/contracts, or accept the manual
  // string for now — chose the latter to avoid reaching into ts-rest internals.
  const res = await postMultipart(
    `${env.EXPO_PUBLIC_API_URL}/api/v1/invoices/parse-quotation`,
    form,
    { authorization },
  );

  if (res.status < 200 || res.status >= 300) {
    const body = isErrorBody(res.body) ? res.body : null;
    throw new ParseQuotationError(res.status, body);
  }

  return ParsedInvoiceDraftSchema.parse(res.body);
}

function isErrorBody(value: unknown): value is { code?: string; message?: string } {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.code === "string" || typeof v.message === "string";
}

export function useParseQuotation() {
  const mutation = useMutation({
    mutationFn: parseQuotationRequest,
  });

  return {
    upload: (input: ParseQuotationInput) => mutation.mutateAsync(input),
    draft: mutation.data ?? null,
    warnings: mutation.data?.warnings ?? [],
    isParsing: mutation.isPending,
    error: normalizeError(mutation.error),
    reset: mutation.reset,
  };
}
