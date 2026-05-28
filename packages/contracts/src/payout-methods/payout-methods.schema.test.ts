import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";
import {
  AddPayoutMethodBodySchema,
  BankAccountDetailsSchema,
  CardDetailsSchema,
  GcashDetailsSchema,
  MayaDetailsSchema,
  PayoutMethodSchema,
  PayoutMethodTypeSchema,
  SetupIntentResponseSchema,
  type AddPayoutMethodBody,
  type PayoutMethod,
  type SetupIntentResponse,
} from "./payout-methods.schema";

const baseEnvelope = {
  id: "00000000-0000-0000-0000-000000000001",
  userId: "00000000-0000-0000-0000-000000000002",
  isDefault: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

const validCard = {
  ...baseEnvelope,
  type: "card",
  details: {
    brand: "visa",
    last4: "4242",
    expMonth: 12,
    expYear: 2030,
    stripePaymentMethodId: "pm_1A2b3C4d",
  },
} satisfies z.input<typeof PayoutMethodSchema>;

const validGcash = {
  ...baseEnvelope,
  type: "gcash",
  details: {
    phoneNumber: "+639171234567",
    accountName: "Juan Dela Cruz",
  },
} satisfies z.input<typeof PayoutMethodSchema>;

const validMaya = {
  ...baseEnvelope,
  type: "maya",
  details: {
    phoneNumber: "+639181234567",
    accountName: "Maria Santos",
  },
} satisfies z.input<typeof PayoutMethodSchema>;

const validBankAccount = {
  ...baseEnvelope,
  type: "bank_account",
  details: {
    bankName: "BPI",
    accountNumberLast4: "9876",
    accountName: "Juan Dela Cruz",
  },
} satisfies z.input<typeof PayoutMethodSchema>;

describe("SetupIntentResponseSchema", () => {
  it("parses a valid Stripe SetupIntent client_secret", () => {
    expect(() =>
      SetupIntentResponseSchema.parse({ clientSecret: "seti_1A2b3C_secret_xyz" }),
    ).not.toThrow();
  });

  it("rejects a client_secret that does not start with seti_", () => {
    expect(() => SetupIntentResponseSchema.parse({ clientSecret: "pm_1A2b3C" })).toThrow();
  });

  it("rejects an empty client_secret", () => {
    expect(() => SetupIntentResponseSchema.parse({ clientSecret: "" })).toThrow();
  });

  it("narrows clientSecret to string at the TypeScript level", () => {
    const res = {} as SetupIntentResponse;
    expectTypeOf(res.clientSecret).toEqualTypeOf<string>();
  });
});

describe("PayoutMethodTypeSchema", () => {
  it("accepts the four supported wire-level types (lowercase, matching Prisma @map)", () => {
    expect(PayoutMethodTypeSchema.parse("card")).toBe("card");
    expect(PayoutMethodTypeSchema.parse("gcash")).toBe("gcash");
    expect(PayoutMethodTypeSchema.parse("maya")).toBe("maya");
    expect(PayoutMethodTypeSchema.parse("bank_account")).toBe("bank_account");
  });

  it("rejects uppercase variants (those are Prisma TS identifiers, not wire values)", () => {
    expect(() => PayoutMethodTypeSchema.parse("CARD")).toThrow();
    expect(() => PayoutMethodTypeSchema.parse("BANK_ACCOUNT")).toThrow();
  });

  it("rejects unknown types", () => {
    expect(() => PayoutMethodTypeSchema.parse("paypal")).toThrow();
  });
});

describe("CardDetailsSchema", () => {
  it("parses a fully populated card details payload", () => {
    expect(() => CardDetailsSchema.parse(validCard.details)).not.toThrow();
  });

  it("rejects a last4 that is not exactly 4 digits", () => {
    expect(() => CardDetailsSchema.parse({ ...validCard.details, last4: "42424" })).toThrow();
    expect(() => CardDetailsSchema.parse({ ...validCard.details, last4: "abcd" })).toThrow();
  });

  it("rejects expMonth outside 1..12", () => {
    expect(() => CardDetailsSchema.parse({ ...validCard.details, expMonth: 0 })).toThrow();
    expect(() => CardDetailsSchema.parse({ ...validCard.details, expMonth: 13 })).toThrow();
  });

  it("rejects a non-integer expYear", () => {
    expect(() => CardDetailsSchema.parse({ ...validCard.details, expYear: 2030.5 })).toThrow();
  });

  it("rejects a stripePaymentMethodId that does not start with pm_", () => {
    expect(() =>
      CardDetailsSchema.parse({
        ...validCard.details,
        stripePaymentMethodId: "seti_123",
      }),
    ).toThrow();
  });

  it("rejects an empty brand", () => {
    expect(() => CardDetailsSchema.parse({ ...validCard.details, brand: "" })).toThrow();
  });
});

describe("GcashDetailsSchema / MayaDetailsSchema", () => {
  it("parses a valid GCash details payload", () => {
    expect(() => GcashDetailsSchema.parse(validGcash.details)).not.toThrow();
  });

  it("parses a valid Maya details payload", () => {
    expect(() => MayaDetailsSchema.parse(validMaya.details)).not.toThrow();
  });

  it("rejects a phoneNumber that is not E.164", () => {
    expect(() =>
      GcashDetailsSchema.parse({ ...validGcash.details, phoneNumber: "09171234567" }),
    ).toThrow();
    expect(() =>
      MayaDetailsSchema.parse({ ...validMaya.details, phoneNumber: "09181234567" }),
    ).toThrow();
  });

  it("rejects an empty accountName", () => {
    expect(() => GcashDetailsSchema.parse({ ...validGcash.details, accountName: "" })).toThrow();
  });
});

describe("BankAccountDetailsSchema", () => {
  it("parses a valid bank account details payload", () => {
    expect(() => BankAccountDetailsSchema.parse(validBankAccount.details)).not.toThrow();
  });

  it("rejects accountNumberLast4 that is not exactly 4 digits", () => {
    expect(() =>
      BankAccountDetailsSchema.parse({
        ...validBankAccount.details,
        accountNumberLast4: "987",
      }),
    ).toThrow();
  });

  it("rejects an empty bankName", () => {
    expect(() =>
      BankAccountDetailsSchema.parse({ ...validBankAccount.details, bankName: "" }),
    ).toThrow();
  });
});

describe("PayoutMethodSchema (discriminated union)", () => {
  it("parses each variant of the discriminated union", () => {
    expect(() => PayoutMethodSchema.parse(validCard)).not.toThrow();
    expect(() => PayoutMethodSchema.parse(validGcash)).not.toThrow();
    expect(() => PayoutMethodSchema.parse(validMaya)).not.toThrow();
    expect(() => PayoutMethodSchema.parse(validBankAccount)).not.toThrow();
  });

  it("rejects a payout method whose details do not match its type tag", () => {
    expect(() =>
      PayoutMethodSchema.parse({
        ...validCard,
        type: "gcash",
      }),
    ).toThrow();
    expect(() =>
      PayoutMethodSchema.parse({
        ...validGcash,
        type: "card",
      }),
    ).toThrow();
  });

  it("rejects an envelope missing required fields", () => {
    const { id: _id, ...withoutId } = validCard;
    expect(() => PayoutMethodSchema.parse(withoutId)).toThrow();

    const { userId: _userId, ...withoutUserId } = validCard;
    expect(() => PayoutMethodSchema.parse(withoutUserId)).toThrow();

    const { isDefault: _isDefault, ...withoutIsDefault } = validCard;
    expect(() => PayoutMethodSchema.parse(withoutIsDefault)).toThrow();

    const { createdAt: _createdAt, ...withoutCreatedAt } = validCard;
    expect(() => PayoutMethodSchema.parse(withoutCreatedAt)).toThrow();

    const { updatedAt: _updatedAt, ...withoutUpdatedAt } = validCard;
    expect(() => PayoutMethodSchema.parse(withoutUpdatedAt)).toThrow();
  });

  it("rejects a non-UUID id or userId", () => {
    expect(() => PayoutMethodSchema.parse({ ...validCard, id: "not-a-uuid" })).toThrow();
    expect(() => PayoutMethodSchema.parse({ ...validCard, userId: "not-a-uuid" })).toThrow();
  });

  it("rejects a non-ISO createdAt or updatedAt", () => {
    expect(() => PayoutMethodSchema.parse({ ...validCard, createdAt: "yesterday" })).toThrow();
    expect(() => PayoutMethodSchema.parse({ ...validCard, updatedAt: "2026-01-02" })).toThrow();
  });

  it("narrows details by type at the TypeScript level", () => {
    const method = {} as PayoutMethod;

    if (method.type === "card") {
      expectTypeOf(method.details.brand).toEqualTypeOf<string>();
      expectTypeOf(method.details.last4).toEqualTypeOf<string>();
      expectTypeOf(method.details.expMonth).toEqualTypeOf<number>();
      expectTypeOf(method.details.expYear).toEqualTypeOf<number>();
      expectTypeOf(method.details.stripePaymentMethodId).toEqualTypeOf<string>();
    }
    if (method.type === "gcash" || method.type === "maya") {
      expectTypeOf(method.details.phoneNumber).toEqualTypeOf<string>();
      expectTypeOf(method.details.accountName).toEqualTypeOf<string>();
    }
    if (method.type === "bank_account") {
      expectTypeOf(method.details.bankName).toEqualTypeOf<string>();
      expectTypeOf(method.details.accountNumberLast4).toEqualTypeOf<string>();
      expectTypeOf(method.details.accountName).toEqualTypeOf<string>();
    }
  });
});

describe("AddPayoutMethodBodySchema (discriminated union)", () => {
  it("accepts a card add request with stripePaymentMethodId", () => {
    expect(() =>
      AddPayoutMethodBodySchema.parse({
        type: "card",
        stripePaymentMethodId: "pm_1A2b3C4d",
      }),
    ).not.toThrow();
  });

  it("accepts a gcash add request with phoneNumber + accountName", () => {
    expect(() =>
      AddPayoutMethodBodySchema.parse({
        type: "gcash",
        phoneNumber: "+639171234567",
        accountName: "Juan Dela Cruz",
      }),
    ).not.toThrow();
  });

  it("accepts a maya add request with phoneNumber + accountName", () => {
    expect(() =>
      AddPayoutMethodBodySchema.parse({
        type: "maya",
        phoneNumber: "+639181234567",
        accountName: "Maria Santos",
      }),
    ).not.toThrow();
  });

  it("accepts a bank_account add request with bankName + accountNumberLast4 + accountName", () => {
    expect(() =>
      AddPayoutMethodBodySchema.parse({
        type: "bank_account",
        bankName: "BPI",
        accountNumberLast4: "9876",
        accountName: "Juan Dela Cruz",
      }),
    ).not.toThrow();
  });

  it("rejects a card add request missing stripePaymentMethodId", () => {
    expect(() => AddPayoutMethodBodySchema.parse({ type: "card" })).toThrow();
  });

  it("rejects a card add request whose stripePaymentMethodId is not a Stripe pm_ id", () => {
    expect(() =>
      AddPayoutMethodBodySchema.parse({
        type: "card",
        stripePaymentMethodId: "seti_123",
      }),
    ).toThrow();
  });

  it("rejects a gcash/maya add request with a non-E.164 phone number", () => {
    expect(() =>
      AddPayoutMethodBodySchema.parse({
        type: "gcash",
        phoneNumber: "09171234567",
        accountName: "Juan",
      }),
    ).toThrow();
  });

  it("narrows the body's payload fields by type at the TypeScript level", () => {
    const body = {} as AddPayoutMethodBody;

    if (body.type === "card") {
      expectTypeOf(body.stripePaymentMethodId).toEqualTypeOf<string>();
    }
    if (body.type === "gcash" || body.type === "maya") {
      expectTypeOf(body.phoneNumber).toEqualTypeOf<string>();
      expectTypeOf(body.accountName).toEqualTypeOf<string>();
    }
    if (body.type === "bank_account") {
      expectTypeOf(body.bankName).toEqualTypeOf<string>();
      expectTypeOf(body.accountNumberLast4).toEqualTypeOf<string>();
      expectTypeOf(body.accountName).toEqualTypeOf<string>();
    }
  });
});
