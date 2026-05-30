import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  ChatMessageSchema,
  ChatRequestSchema,
  ChatToolNameSchema,
  ClientSummaryResultSchema,
  BACKUP_PROMPT_CHIPS,
  DEMO_PROMPT_CHIPS,
  DemoPromptChipSchema,
  EarningsResultSchema,
  InvoiceStatusResultSchema,
} from "./chat.schema";

describe("ChatMessageSchema", () => {
  it("parses a user message", () => {
    expect(() => ChatMessageSchema.parse({ role: "user", content: "hi" })).not.toThrow();
  });

  it("parses an assistant message", () => {
    expect(() => ChatMessageSchema.parse({ role: "assistant", content: "hello" })).not.toThrow();
  });

  it("rejects an unknown role", () => {
    expect(() => ChatMessageSchema.parse({ role: "system", content: "hi" })).toThrow();
  });

  it("rejects empty content", () => {
    expect(() => ChatMessageSchema.parse({ role: "user", content: "" })).toThrow();
  });
});

describe("ChatRequestSchema", () => {
  it("parses a request with at least one message", () => {
    expect(() =>
      ChatRequestSchema.parse({ messages: [{ role: "user", content: "How much did I earn?" }] }),
    ).not.toThrow();
  });

  it("rejects an empty message list", () => {
    expect(() => ChatRequestSchema.parse({ messages: [] })).toThrow();
  });
});

describe("ChatToolNameSchema", () => {
  it("accepts the four tool names", () => {
    for (const name of [
      "query_earnings",
      "get_invoice_status",
      "calculate_tax_estimate",
      "get_client_summary",
    ]) {
      expect(() => ChatToolNameSchema.parse(name)).not.toThrow();
    }
  });

  it("rejects an unknown tool name", () => {
    expect(() => ChatToolNameSchema.parse("delete_everything")).toThrow();
  });
});

describe("EarningsResultSchema", () => {
  const valid = {
    groupBy: "client",
    startDate: "2026-01-01",
    endDate: "2026-03-31",
    totalPhp: 287450,
    invoiceCount: 5,
    rows: [{ label: "Acme Northwind", amountPhp: 187450, invoiceCount: 3 }],
  } satisfies z.input<typeof EarningsResultSchema>;

  it("parses a grouped earnings result", () => {
    expect(() => EarningsResultSchema.parse(valid)).not.toThrow();
  });

  it("accepts a null groupBy and empty rows (ungrouped / no data)", () => {
    expect(() =>
      EarningsResultSchema.parse({
        ...valid,
        groupBy: null,
        totalPhp: 0,
        invoiceCount: 0,
        rows: [],
      }),
    ).not.toThrow();
  });

  it("rejects a negative total", () => {
    expect(() => EarningsResultSchema.parse({ ...valid, totalPhp: -1 })).toThrow();
  });

  it("rejects a non-date startDate", () => {
    expect(() => EarningsResultSchema.parse({ ...valid, startDate: "March" })).toThrow();
  });
});

describe("InvoiceStatusResultSchema", () => {
  const valid = {
    count: 1,
    invoices: [
      {
        id: "00000000-0000-0000-0000-000000000001",
        number: "INV-0001",
        clientName: "Acme Northwind",
        status: "paid",
        amount: 1500,
        currency: "USD",
        issueDate: "2026-01-10",
        dueDate: "2026-02-09",
      },
    ],
  } satisfies z.input<typeof InvoiceStatusResultSchema>;

  it("parses an invoice-status result", () => {
    expect(() => InvoiceStatusResultSchema.parse(valid)).not.toThrow();
  });

  it("accepts an empty invoice list", () => {
    expect(() => InvoiceStatusResultSchema.parse({ count: 0, invoices: [] })).not.toThrow();
  });

  it("rejects an unknown invoice status", () => {
    const [item] = valid.invoices;
    expect(() =>
      InvoiceStatusResultSchema.parse({ ...valid, invoices: [{ ...item, status: "pending" }] }),
    ).toThrow();
  });
});

describe("ClientSummaryResultSchema", () => {
  const valid = {
    name: "Acme Northwind",
    country: "US",
    totalEarnedPhp: 412800,
    invoiceCount: 6,
    lastPaidDate: "2026-05-09",
    averageInvoicePhp: 68800,
  } satisfies z.input<typeof ClientSummaryResultSchema>;

  it("parses a client-summary result", () => {
    expect(() => ClientSummaryResultSchema.parse(valid)).not.toThrow();
  });

  it("accepts null country and null lastPaidDate (never-paid client)", () => {
    expect(() =>
      ClientSummaryResultSchema.parse({ ...valid, country: null, lastPaidDate: null }),
    ).not.toThrow();
  });

  it("rejects a country code that is not 2 chars", () => {
    expect(() => ClientSummaryResultSchema.parse({ ...valid, country: "USA" })).toThrow();
  });
});

describe("demo prompt chips", () => {
  const allChips = [...DEMO_PROMPT_CHIPS, ...BACKUP_PROMPT_CHIPS];

  it("every primary and backup chip matches DemoPromptChipSchema", () => {
    for (const chip of allChips) {
      expect(() => DemoPromptChipSchema.parse(chip)).not.toThrow();
    }
  });

  it("has unique chip ids across primary + backup sets", () => {
    const ids = allChips.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("primary chips cover every tool exactly once (one card each)", () => {
    const tools = DEMO_PROMPT_CHIPS.map((c) => c.tool);
    expect(new Set(tools)).toEqual(new Set(ChatToolNameSchema.options));
    expect(tools.length).toBe(ChatToolNameSchema.options.length);
  });

  it("provides a backup phrasing for every tool", () => {
    const backupTools = new Set(BACKUP_PROMPT_CHIPS.map((c) => c.tool));
    expect(backupTools).toEqual(new Set(ChatToolNameSchema.options));
  });
});
