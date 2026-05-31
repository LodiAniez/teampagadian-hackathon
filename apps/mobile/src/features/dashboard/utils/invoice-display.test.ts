import { describe, expect, it } from "vitest";
import { describeInvoiceStatus, formatInvoiceAmount } from "./invoice-display";

describe("describeInvoiceStatus", () => {
  it("maps paid to a paid tone", () => {
    expect(describeInvoiceStatus("paid")).toEqual({ label: "Paid", tone: "paid" });
  });

  it("maps sent to a pending tone (awaiting payment)", () => {
    expect(describeInvoiceStatus("sent")).toEqual({ label: "Pending", tone: "pending" });
  });

  it("maps overdue, draft, and void to their own tones", () => {
    expect(describeInvoiceStatus("overdue")).toEqual({ label: "Overdue", tone: "overdue" });
    expect(describeInvoiceStatus("draft")).toEqual({ label: "Draft", tone: "draft" });
    expect(describeInvoiceStatus("void")).toEqual({ label: "Void", tone: "void" });
  });
});

describe("formatInvoiceAmount", () => {
  it("formats USD amounts", () => {
    expect(formatInvoiceAmount({ amount: 1000, currency: "USD" })).toContain("1,000");
  });

  it("formats with the invoice's own currency", () => {
    const php = formatInvoiceAmount({ amount: 500, currency: "PHP" });
    expect(php).toContain("500");
  });
});
