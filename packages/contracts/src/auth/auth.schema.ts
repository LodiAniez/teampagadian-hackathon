import { z } from "zod";
import { SupportedCurrencySchema } from "../shared/money";

export const PhoneNumberSchema = z
  .string()
  .regex(/^\+[1-9]\d{6,14}$/, "Phone must be E.164 (e.g., +639171234567)");

export const RequestOtpBodySchema = z.object({
  phone: PhoneNumberSchema,
});
export type RequestOtpBody = z.infer<typeof RequestOtpBodySchema>;

export const RequestOtpResponseSchema = z.object({
  challengeId: z.string().uuid(),
  expiresAt: z.string().datetime(),
});

export const VerifyOtpBodySchema = z.object({
  challengeId: z.string().uuid(),
  code: z.string().length(6).regex(/^\d{6}$/),
});
export type VerifyOtpBody = z.infer<typeof VerifyOtpBodySchema>;

export const SessionSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.string().datetime(),
});
export type Session = z.infer<typeof SessionSchema>;

export const UserSchema = z.object({
  id: z.string().uuid(),
  phone: PhoneNumberSchema,
  name: z.string().nullable(),
  businessName: z.string().nullable(),
  defaultCurrency: SupportedCurrencySchema,
  createdAt: z.string().datetime(),
});
export type User = z.infer<typeof UserSchema>;

export const UpdateProfileBodySchema = z.object({
  name: z.string().min(1).max(120),
  businessName: z.string().min(1).max(120),
  defaultCurrency: SupportedCurrencySchema,
});
export type UpdateProfileBody = z.infer<typeof UpdateProfileBodySchema>;
