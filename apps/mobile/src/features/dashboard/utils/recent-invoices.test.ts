import { describe, expect, it } from "vitest";
import type { InvoiceListItem } from "@raket/contracts";
import { selectRecentInvoices } from "./recent-invoices";

const inv = (id: string, createdAt: string): InvoiceListItem => ({
  id,
  number: `INV-${id}`,
  status: "sent",
  clientName: "Acme",
  amount: 100,
  currency: "USD",
  amountPhp: null,
  issueDate: "2026-05-01",
  dueDate: "2026-05-31",
  createdAt,
});

describe("selectRecentInvoices", () => {
  it("returns an empty array for no invoices", () => {
    expect(selectRecentInvoices([])).toEqual([]);
  });

  it("sorts by createdAt descending (newest first)", () => {
    const result = selectRecentInvoices([
      inv("a", "2026-05-01T00:00:00.000Z"),
      inv("b", "2026-05-03T00:00:00.000Z"),
      inv("c", "2026-05-02T00:00:00.000Z"),
    ]);
    expect(result.map((i) => i.id)).toEqual(["b", "c", "a"]);
  });

  it("caps the result at the limit (default 5)", () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      inv(String(i), `2026-05-0${i + 1}T00:00:00.000Z`),
    );
    expect(selectRecentInvoices(many)).toHaveLength(5);
  });

  it("honours an explicit limit", () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      inv(String(i), `2026-05-0${i + 1}T00:00:00.000Z`),
    );
    expect(selectRecentInvoices(many, 3)).toHaveLength(3);
  });

  it("does not mutate the input array", () => {
    const items = [inv("a", "2026-05-01T00:00:00.000Z"), inv("b", "2026-05-03T00:00:00.000Z")];
    const snapshot = items.map((i) => i.id);
    selectRecentInvoices(items);
    expect(items.map((i) => i.id)).toEqual(snapshot);
  });
});
