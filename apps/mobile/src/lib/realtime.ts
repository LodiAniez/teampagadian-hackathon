import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./auth";

type PayoutInsertHandler = (row: Record<string, unknown>) => void;

/**
 * Subscribe to INSERTs on the `payouts` table and invoke `onInsert` with each
 * new row. Returns an unsubscribe function that tears the channel down.
 *
 * NOTE on scoping: the `payouts` table has no `user_id` column (a payout scopes
 * to a user only via its related payment/payout_method), so we cannot apply the
 * `user_id=eq.<id>` server-side filter the ticket describes. Row visibility is
 * instead expected to come from Supabase RLS on `payouts` for the authenticated
 * user. The `userId` is threaded through so a future denormalised column (or a
 * `payout_method_id` filter) is a one-line change here.
 */
export function subscribeToPayoutInserts({
  userId,
  onInsert,
}: {
  userId: string;
  onInsert: PayoutInsertHandler;
}): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`payouts:user:${userId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "payouts" }, (payload) =>
      onInsert(payload.new as Record<string, unknown>),
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
