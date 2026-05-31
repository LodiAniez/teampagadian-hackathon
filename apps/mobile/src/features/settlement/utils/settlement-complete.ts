import { SETTLEMENT_INVALIDATE_KEYS } from "../constants";

type Deps = {
  queryClient: {
    invalidateQueries: (filters: { queryKey: readonly unknown[] }) => Promise<void> | unknown;
  };
};

/**
 * Returns a handler to run once the settlement animation finishes: invalidate
 * the dashboard + invoices caches so the freelancer sees the new balance without
 * a manual pull-to-refresh. Swallows errors so a torn-down QueryClient can never
 * crash the animation screen.
 */
export function buildSettlementCompleteHandler(deps: Deps): () => Promise<void> {
  return async () => {
    try {
      await Promise.all(
        SETTLEMENT_INVALIDATE_KEYS.map((queryKey) =>
          deps.queryClient.invalidateQueries({ queryKey }),
        ),
      );
    } catch (err) {
      console.warn("[settlement] query invalidation failed:", err);
    }
  };
}
