import { describe, expect, it } from "vitest";
import { z } from "zod";
import { BirElectionSchema, UpdateProfileBodySchema, UserSchema } from "./auth.schema";

const validUser = {
  id: "00000000-0000-0000-0000-000000000001",
  phone: "+639171234567",
  name: "Juan dela Cruz",
  businessName: "JDC Studio",
  defaultCurrency: "USD",
  defaultHourlyRate: { amount: 75, currency: "USD" },
  bir2303Election: "EIGHT_PERCENT",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
} satisfies z.input<typeof UserSchema>;

describe("BirElectionSchema", () => {
  it("accepts 'EIGHT_PERCENT'", () => {
    expect(BirElectionSchema.parse("EIGHT_PERCENT")).toBe("EIGHT_PERCENT");
  });

  it("accepts 'GRADUATED'", () => {
    expect(BirElectionSchema.parse("GRADUATED")).toBe("GRADUATED");
  });

  it("rejects an unknown election value", () => {
    expect(() => BirElectionSchema.parse("flat_tax")).toThrow();
  });
});

describe("UserSchema", () => {
  it("parses a fully populated User", () => {
    expect(() => UserSchema.parse(validUser)).not.toThrow();
  });

  it("accepts User with null optional fields", () => {
    expect(() =>
      UserSchema.parse({
        ...validUser,
        name: null,
        businessName: null,
        defaultHourlyRate: null,
        bir2303Election: null,
      }),
    ).not.toThrow();
  });

  it("accepts any string for defaultCurrency", () => {
    expect(() => UserSchema.parse({ ...validUser, defaultCurrency: "PHP" })).not.toThrow();
  });

  it("rejects a User missing updatedAt", () => {
    const { updatedAt: _, ...withoutUpdatedAt } = validUser;
    expect(() => UserSchema.parse(withoutUpdatedAt)).toThrow();
  });

  it("rejects a User missing defaultHourlyRate field", () => {
    const { defaultHourlyRate: _, ...withoutField } = validUser;
    expect(() => UserSchema.parse(withoutField)).toThrow();
  });
});

describe("UpdateProfileBodySchema", () => {
  it("accepts UpdateProfileDto with only one field", () => {
    expect(() => UpdateProfileBodySchema.parse({ name: "Juan dela Cruz" })).not.toThrow();
  });

  it("accepts an empty UpdateProfileDto object", () => {
    expect(() => UpdateProfileBodySchema.parse({})).not.toThrow();
  });

  it("accepts UpdateProfileDto with defaultHourlyRate and bir2303Election", () => {
    expect(() =>
      UpdateProfileBodySchema.parse({
        defaultHourlyRate: { amount: 100, currency: "USD" },
        bir2303Election: "GRADUATED",
      }),
    ).not.toThrow();
  });
});
