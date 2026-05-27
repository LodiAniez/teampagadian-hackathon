-- TEA-76 prerequisites — two new columns on `payments` consumed by the
-- SettlementService implementation that follows in subsequent slices.
--
-- morph_retry_count: incremented at each PENDING→SETTLING transition (i.e.
--   each viem attempt). SettlementService bails to morph_tx_status='failed'
--   past MAX_RETRIES so a persistent RPC outage doesn't ride Stripe's
--   3-day webhook redelivery loop forever.
--
-- morph_anchor_block: block number captured via publicClient.getBlockNumber()
--   at Phase A. Used as the `fromBlock` for the balance-precheck's
--   Transfer-event scan on retries, narrowing the lookback window so we
--   never scan from genesis. Nullable: rows that predate this column have
--   no anchor (none exist today; forward-only). The precheck falls back to
--   a wide fixed-window scan when null.

-- AlterTable
ALTER TABLE "payments" ADD COLUMN "morph_retry_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "payments" ADD COLUMN "morph_anchor_block" BIGINT;
