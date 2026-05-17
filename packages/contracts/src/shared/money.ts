import { z } from "zod";

export const CurrencyCodeSchema = z
  .string()
  .length(3)
  .regex(/^[A-Z]{3}$/, "Currency must be ISO-4217 (e.g., USD, EUR, PHP)");
export type CurrencyCode = z.infer<typeof CurrencyCodeSchema>;

export const SupportedCurrencySchema = z.enum(["USD", "EUR", "GBP", "PHP"]);
export type SupportedCurrency = z.infer<typeof SupportedCurrencySchema>;
