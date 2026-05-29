// Carries the HTTP status alongside the parsed error body so the orchestrator
// can map 413/415/422/500 to user-facing copy without re-parsing strings.
//
// Kept in its own file (not co-located with use-parse-quotation.ts) so
// importers of this class don't transitively pull the hook's deps —
// expo-secure-store via @/lib/auth has native bindings that Vite's SSR
// parser can't handle. The class itself is pure.
export class ParseQuotationError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: { code?: string; message?: string } | null,
  ) {
    super(body?.message ?? `Request failed: ${status}`);
    this.name = "ParseQuotationError";
  }
}
