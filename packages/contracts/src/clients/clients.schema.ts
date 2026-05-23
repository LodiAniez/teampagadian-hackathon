import { z } from "zod";
import { SupportedCurrencySchema } from "../shared/money";

export const ClientSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1).max(200),
  email: z.string().email().nullable(),
  country: z.string().length(2).nullable(),
  defaultCurrency: SupportedCurrencySchema.nullable(),
  createdAt: z.string().datetime(),
});
export type Client = z.infer<typeof ClientSchema>;
