import { describe, expect, it } from "vitest";
import { z } from "zod";
import { CreateInvoiceBodySchema, InvoiceSchema } from "./invoices.schema";

const validClient = {
  id: "00000000-0000-0000-0000-0000000000a1",
  userId: "00000000-0000-0000-0000-000000000001",
  name: "Acme Co.",
  email: "billing@acme.example",
  country: "US",
  defaultCurrency: "USD",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
} as const;

const validInvoice = {
  id: "00000000-0000-0000-0000-0000000000b1",
  clientId: validClient.id,
  client: validClient,
  number: "INV-2026-0001",
  status: "draft",
  amount: 1500,
  currency: "USD",
  issueDate: "2026-01-15",
  dueDate: "2026-02-14",
  sourceType: "text",
  lineItems: [
    {
      id: "00000000-0000-0000-0000-0000000000c1",
      description: "Design work",
      quantity: 10,
      unit: "hours",
      rate: 150,
      amount: 1500,
    },
  ],
  stripePaymentIntentId: null,
  createdAt: "2026-01-15T00:00:00.000Z",
} satisfies z.input<typeof InvoiceSchema>;

const validCreateBody = {
  clientId: validClient.id,
  currency: "USD",
  issueDate: "2026-01-15",
  dueDate: "2026-02-14",
  sourceType: "text",
  lineItems: [{ description: "Design work", quantity: 10, unit: "hours", rate: 150 }],
} satisfies z.input<typeof CreateInvoiceBodySchema>;

describe("CreateInvoiceBodySchema", () => {
  it("accepts clientId-only", () => {
    expect(() => CreateInvoiceBodySchema.parse(validCreateBody)).not.toThrow();
  });

  it("accepts clientName-only", () => {
    const { clientId: _, ...rest } = validCreateBody;
    expect(() => CreateInvoiceBodySchema.parse({ ...rest, clientName: "Acme Co." })).not.toThrow();
  });

  it("accepts clientName + clientEmail + clientCountry (parse-text path)", () => {
    const { clientId: _, ...rest } = validCreateBody;
    expect(() =>
      CreateInvoiceBodySchema.parse({
        ...rest,
        clientName: "Acme Co.",
        clientEmail: "billing@acme.example",
        clientCountry: "US",
      }),
    ).not.toThrow();
  });

  it("rejects when neither clientId nor clientName is provided", () => {
    const { clientId: _, ...rest } = validCreateBody;
    expect(() => CreateInvoiceBodySchema.parse(rest)).toThrow();
  });

  it("rejects when BOTH clientId and clientName are provided (must be exactly one)", () => {
    expect(() =>
      CreateInvoiceBodySchema.parse({ ...validCreateBody, clientName: "Acme Co." }),
    ).toThrow(/exactly one/i);
  });

  it("rejects empty clientName", () => {
    const { clientId: _, ...rest } = validCreateBody;
    expect(() => CreateInvoiceBodySchema.parse({ ...rest, clientName: "" })).toThrow();
  });

  it("rejects whitespace-only clientName (trim before length check)", () => {
    const { clientId: _, ...rest } = validCreateBody;
    expect(() => CreateInvoiceBodySchema.parse({ ...rest, clientName: "   " })).toThrow();
  });

  it("trims surrounding whitespace on clientName so lookup is normalised", () => {
    const { clientId: _, ...rest } = validCreateBody;
    const parsed = CreateInvoiceBodySchema.parse({ ...rest, clientName: "  Acme Co.  " });
    expect(parsed.clientName).toBe("Acme Co.");
  });

  it("rejects invalid clientEmail", () => {
    const { clientId: _, ...rest } = validCreateBody;
    expect(() =>
      CreateInvoiceBodySchema.parse({
        ...rest,
        clientName: "Acme Co.",
        clientEmail: "not-an-email",
      }),
    ).toThrow();
  });

  it("rejects clientCountry not 2 chars", () => {
    const { clientId: _, ...rest } = validCreateBody;
    expect(() =>
      CreateInvoiceBodySchema.parse({
        ...rest,
        clientName: "Acme Co.",
        clientCountry: "USA",
      }),
    ).toThrow();
  });

  it("rejects an empty lineItems array", () => {
    expect(() => CreateInvoiceBodySchema.parse({ ...validCreateBody, lineItems: [] })).toThrow();
  });
});

describe("InvoiceSchema", () => {
  it("parses a fully populated Invoice with embedded client", () => {
    expect(() => InvoiceSchema.parse(validInvoice)).not.toThrow();
  });

  it("rejects an Invoice missing number", () => {
    const { number: _, ...withoutNumber } = validInvoice;
    expect(() => InvoiceSchema.parse(withoutNumber)).toThrow();
  });

  it("rejects an Invoice missing embedded client", () => {
    const { client: _, ...withoutClient } = validInvoice;
    expect(() => InvoiceSchema.parse(withoutClient)).toThrow();
  });

  it("rejects an Invoice whose client object is malformed", () => {
    expect(() =>
      InvoiceSchema.parse({
        ...validInvoice,
        client: { ...validClient, email: "not-an-email" },
      }),
    ).toThrow();
  });
});
