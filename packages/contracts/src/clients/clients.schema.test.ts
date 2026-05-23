import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ClientSchema } from "./clients.schema";

const validClient = {
  id: "00000000-0000-0000-0000-000000000001",
  userId: "00000000-0000-0000-0000-000000000002",
  name: "Acme Co.",
  email: "billing@acme.example",
  country: "US",
  defaultCurrency: "USD",
  createdAt: "2026-01-01T00:00:00.000Z",
} satisfies z.input<typeof ClientSchema>;

describe("ClientSchema", () => {
  it("parses a fully populated Client", () => {
    expect(() => ClientSchema.parse(validClient)).not.toThrow();
  });

  it("accepts null for email, country, and defaultCurrency", () => {
    expect(() =>
      ClientSchema.parse({
        ...validClient,
        email: null,
        country: null,
        defaultCurrency: null,
      }),
    ).not.toThrow();
  });

  it("rejects an invalid email", () => {
    expect(() => ClientSchema.parse({ ...validClient, email: "not-an-email" })).toThrow();
  });

  it("rejects a country code that is not 2 characters (ISO-3166-1 alpha-2)", () => {
    expect(() => ClientSchema.parse({ ...validClient, country: "USA" })).toThrow();
  });

  it("rejects an unsupported defaultCurrency", () => {
    expect(() => ClientSchema.parse({ ...validClient, defaultCurrency: "JPY" })).toThrow();
  });

  it("rejects an empty name", () => {
    expect(() => ClientSchema.parse({ ...validClient, name: "" })).toThrow();
  });

  it("rejects a Client missing createdAt", () => {
    const { createdAt: _, ...withoutCreatedAt } = validClient;
    expect(() => ClientSchema.parse(withoutCreatedAt)).toThrow();
  });

  it("rejects a non-UUID id", () => {
    expect(() => ClientSchema.parse({ ...validClient, id: "not-a-uuid" })).toThrow();
  });

  it("rejects a non-UUID userId", () => {
    expect(() => ClientSchema.parse({ ...validClient, userId: "not-a-uuid" })).toThrow();
  });
});
