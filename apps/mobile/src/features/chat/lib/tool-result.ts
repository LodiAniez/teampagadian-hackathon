import {
  ClientSummaryResultSchema,
  EarningsResultSchema,
  InvoiceStatusResultSchema,
  TaxComputationSchema,
  type ClientSummaryResult,
  type EarningsResult,
  type InvoiceStatusResult,
  type TaxComputation,
} from "@raket/contracts";

// A tool output validated against its contract schema, ready for the matching
// card. get_client_summary can legitimately be null (no matching paid client).
export type ParsedToolResult =
  | { tool: "query_earnings"; data: EarningsResult }
  | { tool: "get_invoice_status"; data: InvoiceStatusResult }
  | { tool: "calculate_tax_estimate"; data: TaxComputation }
  | { tool: "get_client_summary"; data: ClientSummaryResult | null };

// Validates a raw tool output (from the stream) against the contract. Returns
// null for unknown tools or outputs that don't match — the renderer then skips
// the card rather than crashing on malformed data.
export function parseToolResult(toolName: string, output: unknown): ParsedToolResult | null {
  switch (toolName) {
    case "query_earnings": {
      const r = EarningsResultSchema.safeParse(output);
      return r.success ? { tool: "query_earnings", data: r.data } : null;
    }
    case "get_invoice_status": {
      const r = InvoiceStatusResultSchema.safeParse(output);
      return r.success ? { tool: "get_invoice_status", data: r.data } : null;
    }
    case "calculate_tax_estimate": {
      const r = TaxComputationSchema.safeParse(output);
      return r.success ? { tool: "calculate_tax_estimate", data: r.data } : null;
    }
    case "get_client_summary": {
      if (output === null) return { tool: "get_client_summary", data: null };
      const r = ClientSummaryResultSchema.safeParse(output);
      return r.success ? { tool: "get_client_summary", data: r.data } : null;
    }
    default:
      return null;
  }
}
