import { z } from "zod";
import { BirElectionSchema } from "../auth/auth.schema";

export const TaxFormCodeSchema = z.enum(["1701Q", "1701", "1701A"]);
export type TaxFormCode = z.infer<typeof TaxFormCodeSchema>;

export const PaymentBreakdownRowSchema = z.object({
  date: z.string().date(),
  client: z.string(),
  amountPhp: z.number().nonnegative(),
});
export type PaymentBreakdownRow = z.infer<typeof PaymentBreakdownRowSchema>;

export const TaxComputationSchema = z.object({
  grossReceiptsPhp: z.number().nonnegative(),
  election: BirElectionSchema,
  taxDuePhp: z.number().nonnegative(),
  formCode: TaxFormCodeSchema,
  formName: z.string(),
  deadline: z.string().date(),
  breakdown: z.string(),
  invoiceCount: z.number().int().nonnegative(),
  paymentBreakdown: z.array(PaymentBreakdownRowSchema),
});
export type TaxComputation = z.infer<typeof TaxComputationSchema>;

// BIR does not file Q4 quarterly — the annual return absorbs it (NIRC §74).
export const GetQuarterlyQuerySchema = z.object({
  quarter: z.coerce.number().int().min(1).max(3),
  year: z.coerce.number().int().min(2018).max(2100),
});
export type GetQuarterlyQuery = z.infer<typeof GetQuarterlyQuerySchema>;

export const GetAnnualQuerySchema = z.object({
  year: z.coerce.number().int().min(2018).max(2100),
});
export type GetAnnualQuery = z.infer<typeof GetAnnualQuerySchema>;
