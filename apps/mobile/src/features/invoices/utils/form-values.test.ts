import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ParsedInvoiceDraft } from "@raket/contracts";
import {
  computeInvoiceTotal,
  computeLineTotal,
  emptyFormValues,
  emptyLineItem,
  mapDraftToFormValues,
} from "./form-values";

const FULL_DRAFT: ParsedInvoiceDraft = {
  clientName: "Acme Northwind",
  clientEmail: "accounts@northwind.com",
  currency: "USD",
  issueDate: "2026-05-21",
  dueDate: "2026-06-04",
  warnings: [],
  lineItems: [
    {
      description: "UI design (Northwind app)",
      quantity: 20,
      unit: "hr",
      rate: 80,
      amount: 1600,
    },
  ],
};

describe("mapDraftToFormValues", () => {
  it("maps a fully-populated draft straight through", () => {
    const values = mapDraftToFormValues(FULL_DRAFT);
    expect(values).toMatchObject({
      clientName: "Acme Northwind",
      clientEmail: "accounts@northwind.com",
      currency: "USD",
      issueDate: "2026-05-21",
      dueDate: "2026-06-04",
      sourceType: "text",
    });
    expect(values.lineItems).toEqual([
      { description: "UI design (Northwind app)", quantity: 20, unit: "hr", rate: 80 },
    ]);
  });

  it("falls back to issueDate + 14 days when dueDate is null", () => {
    const values = mapDraftToFormValues({ ...FULL_DRAFT, dueDate: null });
    expect(values.dueDate).toBe("2026-06-04");
  });

  describe("with mocked clock at 2026-05-23", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-05-23T12:00:00Z"));
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("falls back to today when issueDate is invalid, and derives dueDate from that", () => {
      const draft = {
        ...FULL_DRAFT,
        issueDate: "",
        dueDate: null,
      } as unknown as ParsedInvoiceDraft;
      const values = mapDraftToFormValues(draft);
      expect(values.issueDate).toBe("2026-05-23");
      expect(values.dueDate).toBe("2026-06-06");
    });
  });

  it("coerces nullable line-item fields to safe defaults", () => {
    const values = mapDraftToFormValues({
      ...FULL_DRAFT,
      lineItems: [
        { description: "Mystery work", quantity: null, unit: null, rate: null, amount: null },
      ],
    });
    expect(values.lineItems).toEqual([
      { description: "Mystery work", quantity: 1, unit: "", rate: 0 },
    ]);
  });

  it("leaves clientName / clientEmail undefined when the draft has nulls", () => {
    const values = mapDraftToFormValues({
      ...FULL_DRAFT,
      clientName: null,
      clientEmail: null,
    });
    expect(values.clientName).toBeUndefined();
    expect(values.clientEmail).toBeUndefined();
  });

  it("inserts an empty line item when the draft returned zero", () => {
    const values = mapDraftToFormValues({ ...FULL_DRAFT, lineItems: [] });
    expect(values.lineItems).toEqual([emptyLineItem()]);
  });

  it("respects a non-text sourceType when passed", () => {
    const values = mapDraftToFormValues(FULL_DRAFT, "upload");
    expect(values.sourceType).toBe("upload");
  });

  it("preserves multiple line items from the draft", () => {
    const values = mapDraftToFormValues({
      ...FULL_DRAFT,
      lineItems: [
        { description: "Design", quantity: 10, unit: "hr", rate: 80, amount: 800 },
        { description: "Implementation", quantity: 20, unit: "hr", rate: 80, amount: 1600 },
      ],
    });
    expect(values.lineItems).toHaveLength(2);
  });
});

describe("emptyFormValues", () => {
  it("uses today's date and adds 14 days for due date", () => {
    const fixed = new Date("2026-05-23T12:00:00Z");
    const values = emptyFormValues("text", fixed);
    expect(values.issueDate).toBe("2026-05-23");
    expect(values.dueDate).toBe("2026-06-06");
    expect(values.currency).toBe("USD");
    expect(values.sourceType).toBe("text");
    expect(values.lineItems).toEqual([emptyLineItem()]);
  });

  it("defaults sourceType to 'text' when not provided", () => {
    const values = emptyFormValues();
    expect(values.sourceType).toBe("text");
  });
});

describe("emptyLineItem", () => {
  it("returns a safe blank line item with sensible defaults", () => {
    expect(emptyLineItem()).toEqual({ description: "", quantity: 1, unit: "hours", rate: 0 });
  });
});

describe("computeLineTotal / computeInvoiceTotal", () => {
  it("multiplies quantity by rate", () => {
    expect(computeLineTotal({ quantity: 20, rate: 80 })).toBe(1600);
  });

  it("treats missing or NaN values as zero", () => {
    expect(computeLineTotal({ quantity: 0, rate: 80 })).toBe(0);
    expect(computeLineTotal({ quantity: 5, rate: NaN as unknown as number })).toBe(0);
  });

  it("sums multiple line totals for an invoice", () => {
    expect(
      computeInvoiceTotal([
        { description: "a", quantity: 10, unit: "hr", rate: 80 },
        { description: "b", quantity: 5, unit: "hr", rate: 100 },
      ]),
    ).toBe(1300);
  });
});
