import { z } from "zod";

export const EarningsSummarySchema = z.object({
  totalEarnedPhp: z.number().nonnegative(),
  thisMonthPhp: z.number().nonnegative(),
  pendingInvoicesPhp: z.number().nonnegative(),
  pendingInvoicesCount: z.number().int().nonnegative(),
  invoiceCountThisMonth: z.number().int().nonnegative(),
  savingsVsPaypalPhp: z.number().nonnegative(),
});
export type EarningsSummary = z.infer<typeof EarningsSummarySchema>;

export const EarningsByMonthSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  amountPhp: z.number().nonnegative(),
  invoiceCount: z.number().int().nonnegative(),
});
export type EarningsByMonth = z.infer<typeof EarningsByMonthSchema>;

export const EarningsByClientSchema = z.object({
  clientId: z.string().uuid(),
  clientName: z.string(),
  country: z.string().length(2).nullable(),
  totalPhp: z.number().nonnegative(),
  invoiceCount: z.number().int().nonnegative(),
  lastPaidAt: z.string(),
});
export type EarningsByClient = z.infer<typeof EarningsByClientSchema>;

export const EarningsByCountrySchema = z.object({
  country: z.string().length(2),
  totalPhp: z.number().nonnegative(),
  invoiceCount: z.number().int().nonnegative(),
  clientCount: z.number().int().nonnegative(),
});
export type EarningsByCountry = z.infer<typeof EarningsByCountrySchema>;

export const EarningsByMonthQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(36).default(12),
});
export type EarningsByMonthQuery = z.infer<typeof EarningsByMonthQuerySchema>;

export const EarningsByClientQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
export type EarningsByClientQuery = z.infer<typeof EarningsByClientQuerySchema>;
