import { describe, expect, it } from "vitest";
import { parseToolResult } from "./tool-result";

describe("parseToolResult", () => {
  it("parses a query_earnings output", () => {
    const output = {
      groupBy: "client",
      startDate: "2026-01-01",
      endDate: "2026-03-31",
      totalPhp: 1500,
      invoiceCount: 3,
      rows: [{ label: "Acme", amountPhp: 1000, invoiceCount: 2 }],
    };
    const result = parseToolResult("query_earnings", output);
    expect(result).toEqual({ tool: "query_earnings", data: output });
  });

  it("parses a get_invoice_status output", () => {
    const output = {
      count: 1,
      invoices: [
        {
          id: "00000000-0000-0000-0000-000000000001",
          number: "INV-0001",
          clientName: "Acme",
          status: "paid",
          amount: 1500,
          currency: "USD",
          issueDate: "2026-01-10",
          dueDate: "2026-02-09",
        },
      ],
    };
    const result = parseToolResult("get_invoice_status", output);
    expect(result?.tool).toBe("get_invoice_status");
  });

  it("parses a calculate_tax_estimate output (TaxComputation)", () => {
    const output = {
      grossReceiptsPhp: 487200,
      election: "EIGHT_PERCENT",
      taxDuePhp: 38976,
      formCode: "1701Q",
      formName: "Quarterly Income Tax Return",
      deadline: "2026-05-15",
      breakdown: "₱487,200 × 8% = ₱38,976",
      invoiceCount: 4,
      paymentBreakdown: [],
    };
    const result = parseToolResult("calculate_tax_estimate", output);
    expect(result?.tool).toBe("calculate_tax_estimate");
  });

  it("parses a get_client_summary output", () => {
    const output = {
      name: "Acme Northwind",
      country: "US",
      totalEarnedPhp: 412800,
      invoiceCount: 6,
      lastPaidDate: "2026-05-09",
      averageInvoicePhp: 68800,
    };
    const result = parseToolResult("get_client_summary", output);
    expect(result).toEqual({ tool: "get_client_summary", data: output });
  });

  it("represents a null get_client_summary (no matching client) as data: null", () => {
    const result = parseToolResult("get_client_summary", null);
    expect(result).toEqual({ tool: "get_client_summary", data: null });
  });

  it("returns null for an unknown tool name", () => {
    expect(parseToolResult("drop_tables", { foo: 1 })).toBeNull();
  });

  it("returns null when the output fails the tool's schema", () => {
    expect(parseToolResult("query_earnings", { totalPhp: -1 })).toBeNull();
  });
});
