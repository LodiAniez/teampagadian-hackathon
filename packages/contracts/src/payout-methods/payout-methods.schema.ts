import { z } from "zod";
import { PhoneNumberSchema } from "../auth/auth.schema";

export const PayoutMethodTypeSchema = z.enum(["card", "gcash", "maya", "bank_account"]);
export type PayoutMethodType = z.infer<typeof PayoutMethodTypeSchema>;

export const CardDetailsSchema = z.object({
  brand: z.string().min(1).max(32),
  last4: z.string().regex(/^\d{4}$/, "last4 must be exactly 4 digits"),
  expMonth: z.number().int().min(1).max(12),
  expYear: z.number().int().min(2000).max(2100),
  stripePaymentMethodId: z.string().startsWith("pm_"),
});
export type CardDetails = z.infer<typeof CardDetailsSchema>;

export const GcashDetailsSchema = z.object({
  phoneNumber: PhoneNumberSchema,
  accountName: z.string().min(1).max(200),
});
export type GcashDetails = z.infer<typeof GcashDetailsSchema>;

export const MayaDetailsSchema = z.object({
  phoneNumber: PhoneNumberSchema,
  accountName: z.string().min(1).max(200),
});
export type MayaDetails = z.infer<typeof MayaDetailsSchema>;

export const BankAccountDetailsSchema = z.object({
  bankName: z.string().min(1).max(120),
  accountNumberLast4: z.string().regex(/^\d{4}$/, "accountNumberLast4 must be exactly 4 digits"),
  accountName: z.string().min(1).max(200),
});
export type BankAccountDetails = z.infer<typeof BankAccountDetailsSchema>;

const payoutMethodEnvelope = {
  id: z.string().uuid(),
  userId: z.string().uuid(),
  isDefault: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
};

export const PayoutMethodSchema = z.discriminatedUnion("type", [
  z.object({ ...payoutMethodEnvelope, type: z.literal("card"), details: CardDetailsSchema }),
  z.object({ ...payoutMethodEnvelope, type: z.literal("gcash"), details: GcashDetailsSchema }),
  z.object({ ...payoutMethodEnvelope, type: z.literal("maya"), details: MayaDetailsSchema }),
  z.object({
    ...payoutMethodEnvelope,
    type: z.literal("bank_account"),
    details: BankAccountDetailsSchema,
  }),
]);
export type PayoutMethod = z.infer<typeof PayoutMethodSchema>;

const OtpCodeSchema = z.string().regex(/^\d{6}$/, "otpCode must be 6 digits");

export const AddPayoutMethodBodySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("card"),
    stripePaymentMethodId: z.string().startsWith("pm_"),
    otpCode: OtpCodeSchema,
  }),
  z.object({
    type: z.literal("gcash"),
    phoneNumber: PhoneNumberSchema,
    accountName: z.string().min(1).max(200),
    otpCode: OtpCodeSchema,
  }),
  z.object({
    type: z.literal("maya"),
    phoneNumber: PhoneNumberSchema,
    accountName: z.string().min(1).max(200),
    otpCode: OtpCodeSchema,
  }),
  z.object({
    type: z.literal("bank_account"),
    bankName: z.string().min(1).max(120),
    accountNumberLast4: z.string().regex(/^\d{4}$/, "accountNumberLast4 must be exactly 4 digits"),
    accountName: z.string().min(1).max(200),
    otpCode: OtpCodeSchema,
  }),
]);
export type AddPayoutMethodBody = z.infer<typeof AddPayoutMethodBodySchema>;
