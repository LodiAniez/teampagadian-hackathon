import { z } from "zod";
import type { PayoutLandedEvent } from "../types";

/**
 * The subset of a `payouts` row we read off a Supabase realtime INSERT payload.
 * Physical (snake_case) column names; Postgres NUMERIC arrives as a string, so
 * `amount_php` is coerced. The table carries no client name or USD amount —
 * those live on the related payment/invoice — so the event omits them and the
 * animation/toast fall back to demo defaults.
 */
const PayoutInsertRowSchema = z.object({
  id: z.string().min(1),
  amount_php: z.coerce.number().finite(),
});

/** Map a realtime INSERT row to a {@link PayoutLandedEvent}, or null if malformed. */
export function parsePayoutInsert(row: unknown): PayoutLandedEvent | null {
  const parsed = PayoutInsertRowSchema.safeParse(row);
  if (!parsed.success) return null;
  return { payoutId: parsed.data.id, amountPhp: parsed.data.amount_php };
}
