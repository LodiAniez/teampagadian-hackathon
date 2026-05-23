import { describe, it, expect, beforeEach } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import { ParsedInvoiceDraftSchema } from "@raket/contracts";
import { InvoiceParserService } from "../invoice-parser.service";
import type { GeminiService, RawParsedInvoice } from "../../integrations/gemini/gemini.service";

const baseLineItem = {
  description: "Design work",
  quantity: 10,
  unit: "hour",
  rate: 75,
  amount: 750,
};

const baseRaw: RawParsedInvoice = {
  clientName: "Acme Corp",
  clientEmail: null,
  currency: "USD",
  issueDate: "2026-05-22",
  dueDate: "2026-06-05",
  lineItems: [baseLineItem],
};

describe("InvoiceParserService", () => {
  let geminiMock: DeepMockProxy<GeminiService>;
  let service: InvoiceParserService;

  beforeEach(() => {
    geminiMock = mockDeep<GeminiService>();
    service = new InvoiceParserService(geminiMock);
  });

  function stubGemini(raw: RawParsedInvoice): void {
    geminiMock.parseInvoiceText.mockResolvedValue(raw);
  }

  it("passes a clean draft through unchanged with no warnings", async () => {
    stubGemini(baseRaw);
    const result = await service.parse("...");

    expect(result.warnings).toEqual([]);
    expect(result.lineItems).toEqual([baseLineItem]);
    expect(result.currency).toBe("USD");
    expect(result.issueDate).toBe("2026-05-22");
    expect(ParsedInvoiceDraftSchema.safeParse(result).success).toBe(true);
  });

  it("coerces quantity: 0 to null and warns", async () => {
    stubGemini({ ...baseRaw, lineItems: [{ ...baseLineItem, quantity: 0 }] });
    const result = await service.parse("...");

    expect(result.lineItems[0].quantity).toBeNull();
    expect(result.warnings.some((w) => w.includes("not positive"))).toBe(true);
    expect(ParsedInvoiceDraftSchema.safeParse(result).success).toBe(true);
  });

  it("coerces negative quantity to null and warns", async () => {
    stubGemini({ ...baseRaw, lineItems: [{ ...baseLineItem, quantity: -3 }] });
    const result = await service.parse("...");

    expect(result.lineItems[0].quantity).toBeNull();
    expect(result.warnings.some((w) => w.includes("not positive"))).toBe(true);
  });

  it("coerces negative rate to null and warns", async () => {
    stubGemini({ ...baseRaw, lineItems: [{ ...baseLineItem, rate: -50 }] });
    const result = await service.parse("...");

    expect(result.lineItems[0].rate).toBeNull();
    expect(result.warnings.some((w) => w.includes("negative"))).toBe(true);
    expect(ParsedInvoiceDraftSchema.safeParse(result).success).toBe(true);
  });

  it("coerces negative amount to null and warns", async () => {
    stubGemini({ ...baseRaw, lineItems: [{ ...baseLineItem, amount: -100 }] });
    const result = await service.parse("...");

    expect(result.lineItems[0].amount).toBeNull();
    expect(result.warnings.some((w) => w.includes("negative"))).toBe(true);
    expect(ParsedInvoiceDraftSchema.safeParse(result).success).toBe(true);
  });

  it("drops line items with an empty description and warns", async () => {
    stubGemini({
      ...baseRaw,
      lineItems: [{ ...baseLineItem, description: "" }, baseLineItem],
    });
    const result = await service.parse("...");

    expect(result.lineItems).toHaveLength(1);
    expect(result.lineItems[0].description).toBe("Design work");
    expect(result.warnings.some((w) => w.includes("no description"))).toBe(true);
    expect(ParsedInvoiceDraftSchema.safeParse(result).success).toBe(true);
  });

  it("drops line items with a whitespace-only description", async () => {
    stubGemini({ ...baseRaw, lineItems: [{ ...baseLineItem, description: "   " }] });
    const result = await service.parse("...");

    expect(result.lineItems).toHaveLength(0);
  });

  it("falls back to defaultCurrency when raw currency is null", async () => {
    stubGemini({ ...baseRaw, currency: null });
    const result = await service.parse("...", "PHP");

    expect(result.currency).toBe("PHP");
  });

  it("falls back to USD when raw currency is invalid and no default is given", async () => {
    stubGemini({ ...baseRaw, currency: "ZZZ" });
    const result = await service.parse("...");

    expect(result.currency).toBe("USD");
  });

  it("uses today's date when raw issueDate is null", async () => {
    stubGemini({ ...baseRaw, issueDate: null });
    const result = await service.parse("...");

    expect(result.issueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("warns when clientName is null", async () => {
    stubGemini({ ...baseRaw, clientName: null });
    const result = await service.parse("...");

    expect(result.warnings.some((w) => w.includes("Client name"))).toBe(true);
  });

  it("warns when dueDate is null", async () => {
    stubGemini({ ...baseRaw, dueDate: null });
    const result = await service.parse("...");

    expect(result.warnings.some((w) => w.includes("Due date"))).toBe(true);
  });

  it("warns when quantity is null without coercing", async () => {
    stubGemini({ ...baseRaw, lineItems: [{ ...baseLineItem, quantity: null }] });
    const result = await service.parse("...");

    expect(result.lineItems[0].quantity).toBeNull();
    expect(result.warnings.some((w) => w.includes("Quantity not found"))).toBe(true);
  });
});
