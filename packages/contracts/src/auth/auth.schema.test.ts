import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  AuthSessionSchema,
  BirElectionSchema,
  RequestOtpBodySchema,
  RequestOtpResponseSchema,
  UpdateProfileBodySchema,
  UserSchema,
  VerifyOtpBodySchema,
  VerifyOtpResponseSchema,
} from "./auth.schema";

const validUser = {
  id: "00000000-0000-0000-0000-000000000001",
  phone: "+639171234567",
  name: "Juan dela Cruz",
  businessName: "JDC Studio",
  defaultCurrency: "USD",
  defaultHourlyRate: { amount: 75, currency: "USD" },
  bir2303Election: "8_percent",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
} satisfies z.input<typeof UserSchema>;

describe("BirElectionSchema", () => {
  it("accepts '8_percent'", () => {
    expect(BirElectionSchema.parse("8_percent")).toBe("8_percent");
  });

  it("accepts 'graduated'", () => {
    expect(BirElectionSchema.parse("graduated")).toBe("graduated");
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
      })
    ).not.toThrow();
  });

  it("accepts any string for defaultCurrency", () => {
    expect(() =>
      UserSchema.parse({ ...validUser, defaultCurrency: "PHP" })
    ).not.toThrow();
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

describe("RequestOtpBodySchema", () => {
  it("accepts a valid E.164 phone number", () => {
    expect(() =>
      RequestOtpBodySchema.parse({ phone: "+639171234567" })
    ).not.toThrow();
  });

  it("rejects a phone number without + prefix", () => {
    expect(() =>
      RequestOtpBodySchema.parse({ phone: "639171234567" })
    ).toThrow();
  });
});

describe("RequestOtpResponseSchema", () => {
  it("parses RequestOtpResponse with success literal and expiresInSeconds", () => {
    expect(() =>
      RequestOtpResponseSchema.parse({ success: true, expiresInSeconds: 300 })
    ).not.toThrow();
  });

  it("includes optional devOtpCode in RequestOtpResponse", () => {
    expect(() =>
      RequestOtpResponseSchema.parse({
        success: true,
        expiresInSeconds: 300,
        devOtpCode: "123456",
      })
    ).not.toThrow();
  });

  it("rejects RequestOtpResponse missing expiresInSeconds", () => {
    expect(() =>
      RequestOtpResponseSchema.parse({ success: true })
    ).toThrow();
  });

  it("rejects RequestOtpResponse with success: false", () => {
    expect(() =>
      RequestOtpResponseSchema.parse({ success: false, expiresInSeconds: 300 })
    ).toThrow();
  });
});

describe("VerifyOtpBodySchema", () => {
  it("parses VerifyOtpDto with phone and code", () => {
    expect(() =>
      VerifyOtpBodySchema.parse({ phone: "+639171234567", code: "123456" })
    ).not.toThrow();
  });

  it("rejects VerifyOtpDto missing phone", () => {
    expect(() => VerifyOtpBodySchema.parse({ code: "123456" })).toThrow();
  });

  it("rejects VerifyOtpDto with non-numeric code", () => {
    expect(() =>
      VerifyOtpBodySchema.parse({ phone: "+639171234567", code: "abc123" })
    ).toThrow();
  });

  it("rejects VerifyOtpDto with a code shorter than 6 digits", () => {
    expect(() =>
      VerifyOtpBodySchema.parse({ phone: "+639171234567", code: "12345" })
    ).toThrow();
  });
});

describe("VerifyOtpResponseSchema", () => {
  it("parses VerifyOtpResponse with user, accessToken, isNewUser", () => {
    expect(() =>
      VerifyOtpResponseSchema.parse({
        user: validUser,
        accessToken: "eyJhbGciOiJIUzI1NiJ9.test.sig",
        isNewUser: false,
      })
    ).not.toThrow();
  });

  it("rejects VerifyOtpResponse missing isNewUser", () => {
    expect(() =>
      VerifyOtpResponseSchema.parse({
        user: validUser,
        accessToken: "eyJhbGciOiJIUzI1NiJ9.test.sig",
      })
    ).toThrow();
  });
});

describe("AuthSessionSchema", () => {
  it("parses AuthSession JWT payload", () => {
    expect(() =>
      AuthSessionSchema.parse({
        userId: "00000000-0000-0000-0000-000000000001",
        phone: "+639171234567",
        iat: 1700000000,
        exp: 1700086400,
      })
    ).not.toThrow();
  });

  it("rejects AuthSession missing userId", () => {
    expect(() =>
      AuthSessionSchema.parse({
        phone: "+639171234567",
        iat: 1700000000,
        exp: 1700086400,
      })
    ).toThrow();
  });
});

describe("UpdateProfileBodySchema", () => {
  it("accepts UpdateProfileDto with only one field", () => {
    expect(() =>
      UpdateProfileBodySchema.parse({ name: "Juan dela Cruz" })
    ).not.toThrow();
  });

  it("accepts an empty UpdateProfileDto object", () => {
    expect(() => UpdateProfileBodySchema.parse({})).not.toThrow();
  });

  it("accepts UpdateProfileDto with defaultHourlyRate and bir2303Election", () => {
    expect(() =>
      UpdateProfileBodySchema.parse({
        defaultHourlyRate: { amount: 100, currency: "USD" },
        bir2303Election: "graduated",
      })
    ).not.toThrow();
  });
});
