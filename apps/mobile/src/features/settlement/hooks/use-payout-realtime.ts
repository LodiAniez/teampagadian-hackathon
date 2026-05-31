import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useRouter } from "expo-router";
import { subscribeToPayoutInserts } from "@/lib/realtime";
import { shouldSubscribe } from "../utils/app-state";
import { parsePayoutInsert } from "../utils/payout-event";
import type { PayoutLandedEvent } from "../types";

/**
 * Holds a Supabase realtime subscription to `payouts` INSERTs open while the app
 * is foregrounded for the signed-in user, and routes to the settlement-animation
 * screen when money lands. Connects on mount (login), drops the channel on
 * background, and reconnects on foreground — see {@link shouldSubscribe}.
 *
 * Mount once, high in the authed tree (the authed layout). No-ops without a user.
 */
export function usePayoutRealtime(userId: string | undefined): void {
  const router = useRouter();

  // Keep the latest navigation target in a ref so the AppState effect can stay
  // keyed only on userId and not re-subscribe whenever the router identity changes.
  const onLandedRef = useRef<(event: PayoutLandedEvent) => void>(() => undefined);
  onLandedRef.current = (event) => {
    router.push({
      pathname: "/settlement",
      params: {
        payoutId: event.payoutId,
        amountPhp: String(event.amountPhp),
        ...(event.clientName ? { clientName: event.clientName } : {}),
      },
    });
  };

  useEffect(() => {
    if (!userId) return;

    let unsubscribe: (() => void) | null = null;

    const connect = () => {
      if (unsubscribe) return;
      unsubscribe = subscribeToPayoutInserts({
        userId,
        onInsert: (row) => {
          const event = parsePayoutInsert(row);
          if (event) onLandedRef.current(event);
        },
      });
    };

    const disconnect = () => {
      unsubscribe?.();
      unsubscribe = null;
    };

    const sync = (status: AppStateStatus) => {
      if (shouldSubscribe(status)) connect();
      else disconnect();
    };

    sync(AppState.currentState);
    const sub = AppState.addEventListener("change", sync);

    return () => {
      sub.remove();
      disconnect();
    };
  }, [userId]);
}
