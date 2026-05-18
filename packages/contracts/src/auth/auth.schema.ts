import { z } from "zod";

export const PhoneNumberSchema = z
  .string()
  .regex(/^\+[1-9]\d{6,14}$/, "Phone must be E.164 (e.g., +639171234567)");

export const BirElectionSchema = z.enum(["8_percent", "graduated"]);
export type BirElection = z.infer<typeof BirElectionSchema>;

export const RequestOtpBodySchema = z.object({
  phone: PhoneNumberSchema,
});
export type RequestOtpDto = z.infer<typeof RequestOtpBodySchema>;

export const RequestOtpResponseSchema = z.object({
  success: z.literal(true),
  expiresInSeconds: z.number().int().positive(),
  devOtpCode: z.string().length(6).regex(/^\d{6}$/).optional(), // demo only — remove before real launch
});
export type RequestOtpResponse = z.infer<typeof RequestOtpResponseSchema>;

export const VerifyOtpBodySchema = z.object({
  phone: PhoneNumberSchema,
  code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
});
export type VerifyOtpDto = z.infer<typeof VerifyOtpBodySchema>;

export const UserSchema = z.object({
  id: z.string().uuid(),
  phone: PhoneNumberSchema,
  name: z.string().nullable(),
  businessName: z.string().nullable(),
  defaultCurrency: z.string(),
  defaultHourlyRate: z.object({ amount: z.number(), currency: z.string() }).nullable(),
  bir2303Election: BirElectionSchema.nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type User = z.infer<typeof UserSchema>;

export const VerifyOtpResponseSchema = z.object({
  user: UserSchema,
  accessToken: z.string(),
  isNewUser: z.boolean(),
});
export type VerifyOtpResponse = z.infer<typeof VerifyOtpResponseSchema>;

export const AuthSessionSchema = z.object({
  userId: z.string().uuid(),
  phone: PhoneNumberSchema,
  iat: z.number().int(),
  exp: z.number().int(),
});
export type AuthSession = z.infer<typeof AuthSessionSchema>;

export const UpdateProfileBodySchema = z
  .object({
    name: z.string().min(1).max(120),
    businessName: z.string().min(1).max(120),
    defaultCurrency: z.string(),
    defaultHourlyRate: z.object({ amount: z.number().positive(), currency: z.string() }),
    bir2303Election: BirElectionSchema,
  })
  .partial();
export type UpdateProfileDto = z.infer<typeof UpdateProfileBodySchema>;
