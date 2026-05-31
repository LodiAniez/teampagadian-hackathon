import {
  ChatToolNameSchema,
  EarningsGroupBySchema,
  InvoiceStatusSchema,
  type ChatToolName,
} from "@raket/contracts";
import { z } from "zod";
import type { ChatToolsService } from "./chat-tools.service";

// Tool *input* schemas. These describe what the model is allowed to send — they
// are internal to the AI loop, not wire contracts for our own endpoints, so they
// live in the API layer rather than @raket/contracts. Crucially, `userId` is
// NOT a field on any of them: it comes from the JWT and is supplied as a closure
// argument in `execute`, so the model can never read another user's data.

export const QueryEarningsInputSchema = z.object({
  start_date: z.string().date(),
  end_date: z.string().date(),
  country: z.string().length(2).optional(),
  client_name: z.string().min(1).optional(),
  group_by: EarningsGroupBySchema.optional(),
});
export type QueryEarningsInput = z.infer<typeof QueryEarningsInputSchema>;

export const GetInvoiceStatusInputSchema = z.object({
  status: InvoiceStatusSchema.optional(),
  client_name: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(50).default(5),
});
export type GetInvoiceStatusInput = z.infer<typeof GetInvoiceStatusInputSchema>;

// Quarter is 1-3 (BIR files no Q4 quarterly — the annual return absorbs it).
// On the wire it's a string enum, not a numeric literal union: Gemini's tool
// schema requires every enum value to be a string (TYPE_STRING) and rejects the
// whole tool set with a 400 otherwise.
//
// The schema is deliberately a *pure* string enum with no `.transform()`: the AI
// SDK validates the model's args against this schema (as `inputSchema`) and then
// `execute` re-parses the same value, so the schema must be idempotent — a
// transform would mutate the value on the first parse and then throw on the
// second (number fed back into a string enum). The string → numeric `1 | 2 | 3`
// conversion that TaxCalculatorService.computeQuarterly needs happens once, at
// the `execute` boundary, via QUARTER_VALUES (a lookup, so no cast).
export const QUARTER_VALUES = { "1": 1, "2": 2, "3": 3 } as const;
export const CalculateTaxEstimateInputSchema = z.object({
  quarter: z.enum(["1", "2", "3"]),
  year: z.number().int().min(2018).max(2100),
});
// The numeric-quarter shape the tax calculator consumes, after the execute-time
// conversion from the wire string. Not `z.infer` of the schema above, which is
// string-quartered.
export interface CalculateTaxEstimateInput {
  quarter: (typeof QUARTER_VALUES)[keyof typeof QUARTER_VALUES];
  year: number;
}

export const GetClientSummaryInputSchema = z.object({
  client_name: z.string().min(1).optional(),
});
export type GetClientSummaryInput = z.infer<typeof GetClientSummaryInputSchema>;

// A provider-agnostic tool definition. TEA-55 wraps these in the Vercel AI SDK's
// `tool()` by closing over `userId` — `tool({ description, parameters, execute:
// (input) => def.execute(userId, input) })`. Keeping the SDK out of this file
// lets the tool logic be unit-tested without a model in the loop. `execute` is
// async so a parameter-validation failure surfaces as a promise rejection the
// streaming loop can handle, not a synchronous throw mid-call.
export interface ChatToolDef {
  description: string;
  parameters: z.ZodObject<z.ZodRawShape>;
  execute: (userId: string, input: unknown) => Promise<unknown>;
}

export function buildChatToolDefs(service: ChatToolsService): Record<ChatToolName, ChatToolDef> {
  return {
    query_earnings: {
      description:
        "Query the freelancer's earnings within a date range, optionally filtered by country or client and grouped by client, country, or month. Amounts are in PHP.",
      parameters: QueryEarningsInputSchema,
      execute: async (userId, input) =>
        service.queryEarnings(userId, QueryEarningsInputSchema.parse(input)),
    },
    get_invoice_status: {
      description:
        "List the freelancer's invoices, optionally filtered by status (draft, sent, paid, overdue, void) and/or client name. Returns the most recent matches plus the total match count.",
      parameters: GetInvoiceStatusInputSchema,
      execute: async (userId, input) =>
        service.getInvoiceStatus(userId, GetInvoiceStatusInputSchema.parse(input)),
    },
    calculate_tax_estimate: {
      description:
        "Estimate Philippine BIR quarterly income tax for a given quarter (1-3) and year, using the freelancer's BIR election. Computed deterministically, not by the model.",
      parameters: CalculateTaxEstimateInputSchema,
      execute: async (userId, input) => {
        const { quarter, year } = CalculateTaxEstimateInputSchema.parse(input);
        return service.calculateTaxEstimate(userId, { quarter: QUARTER_VALUES[quarter], year });
      },
    },
    get_client_summary: {
      description:
        "Summarize a single client by total PHP earned, invoice count, last paid date, and average invoice size. Returns the top client when no name is given; null when there is no matching paid client.",
      parameters: GetClientSummaryInputSchema,
      execute: async (userId, input) =>
        service.getClientSummary(userId, GetClientSummaryInputSchema.parse(input)),
    },
  };
}

// Re-exported so TEA-55 / tests can iterate the canonical tool-name set.
export const CHAT_TOOL_NAMES = ChatToolNameSchema.options;
