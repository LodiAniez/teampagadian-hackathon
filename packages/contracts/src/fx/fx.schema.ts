import { z } from "zod";

export const FX_PROVIDERS = ["raket", "paypal", "wise", "bank"] as const;

export const FxProviderComparisonSchema = z.object({
  provider: z.enum(FX_PROVIDERS),
  label: z.string(),
  feePct: z.number().nonnegative(),
  feePhp: z.number().nonnegative(),
  receivedPhp: z.number().nonnegative(),
  // raket.receivedPhp - thisProvider.receivedPhp: positive when Raket nets the
  // freelancer more (the common case), 0 on the Raket row, negative when the
  // provider's fee is lower than Raket's (e.g. Wise at 0.65% vs Raket's 1%).
  deltaVsRaketPhp: z.number(),
});
export type FxProviderComparison = z.infer<typeof FxProviderComparisonSchema>;

export const FxComparisonSchema = z.object({
  usdAmount: z.number().positive(),
  phpRate: z.number().positive(),
  providers: z.array(FxProviderComparisonSchema),
  savedVsPaypalPhp: z.number().nonnegative(),
});
export type FxComparison = z.infer<typeof FxComparisonSchema>;

export const FxCompareQuerySchema = z.object({
  usd: z.coerce.number().positive().max(1_000_000),
});
export type FxCompareQuery = z.infer<typeof FxCompareQuerySchema>;
