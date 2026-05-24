import { z } from "zod";

export const PhoneNumberSchema = z
  .string()
  .regex(/^\+[1-9]\d{6,14}$/, "Phone must be E.164 (e.g., +639171234567)");

export const BirElectionSchema = z.enum(["8_percent", "graduated"]);
export type BirElection = z.infer<typeof BirElectionSchema>;

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
