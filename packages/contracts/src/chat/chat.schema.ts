import { z } from "zod";
import { InvoiceStatusSchema } from "../invoices/invoices.schema";
import { SupportedCurrencySchema } from "../shared/money";

// ── Messaging ───────────────────────────────────────────────────────────────
// The wire shape for the "Ask your books" chat. The streaming response can't be
// modelled by ts-rest (it's an AI-SDK data stream), so — like the multipart
// quotation upload in invoices.schema.ts — these schemas live here and the
// endpoint (TEA-55) validates its body with ChatRequestSchema in a plain Nest
// route rather than going through the ts-rest router.

export const ChatRoleSchema = z.enum(["user", "assistant"]);
export type ChatRole = z.infer<typeof ChatRoleSchema>;

export const ChatMessageSchema = z.object({
  role: ChatRoleSchema,
  content: z.string().min(1),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatRequestSchema = z.object({
  messages: z.array(ChatMessageSchema).min(1),
});
export type ChatRequestDto = z.infer<typeof ChatRequestSchema>;

// ── Tool identity ─────────────────────────────────────────────────────────────
// Mirrors the four tools the model can call (TEA-54). Used to tag tool-result
// stream parts so the mobile client renders the right card.
export const ChatToolNameSchema = z.enum([
  "query_earnings",
  "get_invoice_status",
  "calculate_tax_estimate",
  "get_client_summary",
]);
export type ChatToolName = z.infer<typeof ChatToolNameSchema>;

// ── Tool-result payloads ──────────────────────────────────────────────────────
// What each tool's `execute` returns (TEA-54), and what the mobile tool-cards
// render (TEA-56). Monetary results are in PHP — the assistant reports in PHP —
// hence the `Php` suffixes. Empty results are zeroed / empty arrays, never null.

const amountPhp = z.number().nonnegative();
const count = z.number().int().nonnegative();

export const EarningsGroupBySchema = z.enum(["client", "country", "month"]);
export type EarningsGroupBy = z.infer<typeof EarningsGroupBySchema>;

export const EarningsRowSchema = z.object({
  label: z.string(),
  amountPhp,
  invoiceCount: count,
});
export type EarningsRow = z.infer<typeof EarningsRowSchema>;

export const EarningsResultSchema = z.object({
  groupBy: EarningsGroupBySchema.nullable(),
  startDate: z.string().date(),
  endDate: z.string().date(),
  totalPhp: amountPhp,
  invoiceCount: count,
  rows: z.array(EarningsRowSchema),
});
export type EarningsResult = z.infer<typeof EarningsResultSchema>;

export const InvoiceStatusItemSchema = z.object({
  id: z.string().uuid(),
  number: z.string(),
  clientName: z.string(),
  status: InvoiceStatusSchema,
  amount: z.number().nonnegative(),
  currency: SupportedCurrencySchema,
  issueDate: z.string().date(),
  dueDate: z.string().date(),
});
export type InvoiceStatusItem = z.infer<typeof InvoiceStatusItemSchema>;

export const InvoiceStatusResultSchema = z.object({
  count,
  invoices: z.array(InvoiceStatusItemSchema),
});
export type InvoiceStatusResult = z.infer<typeof InvoiceStatusResultSchema>;

// Note: the tax tool (`calculate_tax_estimate`) returns the canonical
// `TaxComputation` from tax.schema.ts — the deterministic M8 calculator's
// output — rather than a parallel chat-specific shape, so the tax figures have
// a single source of truth.

export const ClientSummaryResultSchema = z.object({
  name: z.string(),
  country: z.string().length(2).nullable(),
  totalEarnedPhp: amountPhp,
  invoiceCount: count,
  lastPaidDate: z.string().date().nullable(),
  averageInvoicePhp: amountPhp,
});
export type ClientSummaryResult = z.infer<typeof ClientSummaryResultSchema>;

// ── Demo prompt chips ─────────────────────────────────────────────────────────
// Shared source of truth for the chat composer's quick prompts. `tool` records
// which tool the chip is meant to exercise — the set covers all four so the demo
// lands on every card. Curated (TEA-57) against the TEA-64 seed (Maria Santos;
// top client Northwind; 25 invoices Jan–May 2026; Q1 has ≥5 paid). See
// docs/demo-chat-prompts.md for the rehearsal checklist + expected answers.
export const DemoPromptChipSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  prompt: z.string().min(1),
  tool: ChatToolNameSchema,
});
export type DemoPromptChip = z.infer<typeof DemoPromptChipSchema>;

// Primary chips shown in the composer — one per tool.
export const DEMO_PROMPT_CHIPS = [
  {
    id: "us-earnings",
    label: "US clients this quarter",
    prompt: "How much did I earn from US clients this quarter?",
    tool: "query_earnings",
  },
  {
    id: "biggest-client",
    label: "Biggest client",
    prompt: "Who's my biggest client this year?",
    tool: "get_client_summary",
  },
  {
    id: "q1-tax",
    label: "Q1 tax estimate",
    prompt: "What's my tax estimate for Q1?",
    tool: "calculate_tax_estimate",
  },
  {
    id: "unpaid",
    label: "Unpaid invoices",
    prompt: "Show me my unpaid invoices",
    tool: "get_invoice_status",
  },
] as const satisfies readonly DemoPromptChip[];

// Backup phrasings (one per tool) for the presenter to fall back on if Gemini
// routes a primary to the wrong tool on the day. Not rendered in the composer.
export const BACKUP_PROMPT_CHIPS = [
  {
    id: "earnings-year",
    label: "Earnings this year",
    prompt: "What are my total earnings this year?",
    tool: "query_earnings",
  },
  {
    id: "top-client-summary",
    label: "Top client summary",
    prompt: "Give me a summary of my top client.",
    tool: "get_client_summary",
  },
  {
    id: "tax-q1-alt",
    label: "Q1 tax owed",
    prompt: "How much income tax will I owe for the first quarter of this year?",
    tool: "calculate_tax_estimate",
  },
  {
    id: "awaiting-payment",
    label: "Awaiting payment",
    prompt: "Which invoices are still awaiting payment?",
    tool: "get_invoice_status",
  },
] as const satisfies readonly DemoPromptChip[];
