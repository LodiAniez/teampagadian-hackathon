-- Safety guard: this migration adds NOT NULL columns to `payments` without
-- defaults (user_id, stripe_payment_intent_id, fx_fee_amount, fx_fee_percent).
-- That only works on an empty table. PaymentsService is a stub at the time
-- of writing, so the assumption holds — but assert it explicitly so a future
-- re-run against a populated DB fails fast with a clear message instead of
-- mid-statement.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM payments LIMIT 1) THEN
    RAISE EXCEPTION 'payments table is non-empty; the NOT NULL adds in this migration require a backfill — split into nullable-add + backfill + SET NOT NULL before re-running.';
  END IF;
END $$;

-- CreateEnum
-- pending: row created by the webhook; on-chain leg not started. Default.
--          The TEA-76 retry sweep MUST NOT pick these up.
-- settling: writeContract submitted, awaiting waitForTransactionReceipt.
--           This is what the sweep targets.
-- settled: receipt confirmed; morph_tx_hash populated.
-- failed: retries exhausted; ops manual recovery.
CREATE TYPE "morph_tx_status" AS ENUM ('pending', 'settling', 'settled', 'failed');

-- Safety guard: payouts rows can carry only values that map cleanly to the
-- new enum. The CASE expression below handles `succeeded → delivered`; any
-- other unexpected legacy value (e.g. a value introduced by an ad-hoc fix-up
-- script) would silently widen into the new enum. Assert that no such values
-- exist so the migration fails fast with a clear message instead of letting
-- malformed data through.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM payouts
    WHERE status::text NOT IN ('pending', 'succeeded', 'failed')
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'payouts contains status values outside the expected old enum set (pending|succeeded|failed); backfill before re-running so the CASE remap below is exhaustive.';
  END IF;
END $$;

-- AlterEnum
-- Swap PayoutStatus to PENDING | PROCESSING | DELIVERED | FAILED.
-- `succeeded` is mapped to `delivered` — the rename is a semantic correction
-- (per prd.md §7 + architecture §7: PHP landed in GCash, not just on-chain).
-- `processing` is new (in-flight mocked Coins.ph leg). The CASE in USING does
-- the data-preserving remap so the migration works on populated tables too
-- (not just empty ones).
-- No inner BEGIN/COMMIT here: Prisma wraps each migration file in a
-- transaction, so an explicit COMMIT would close the outer tx early and
-- leave statements below running in auto-commit.
CREATE TYPE "payout_status_new" AS ENUM ('pending', 'processing', 'delivered', 'failed');
ALTER TABLE "public"."payouts" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "payouts" ALTER COLUMN "status" TYPE "payout_status_new" USING (
  CASE status::text
    WHEN 'succeeded' THEN 'delivered'
    ELSE status::text
  END::"payout_status_new"
);
ALTER TYPE "payout_status" RENAME TO "payout_status_old";
ALTER TYPE "payout_status_new" RENAME TO "payout_status";
DROP TYPE "public"."payout_status_old";
ALTER TABLE "payouts" ALTER COLUMN "status" SET DEFAULT 'pending';

-- DropIndex
-- Drop stripe_charge_id's UNIQUE constraint — see schema comment on
-- Payment.stripeChargeId. The PI is now the idempotency key; a charge ID
-- can recur across PI retries (e.g. 3DS fallback).
DROP INDEX "payments_stripe_charge_id_key";

-- DropIndex
-- Drop the plain index on payouts.payment_id — it's superseded by the new
-- UNIQUE index (payouts_payment_id_key) created below for the 1:1 relation.
DROP INDEX "payouts_payment_id_idx";

-- AlterTable: payments
-- Renames preserved as RENAME COLUMN (clean audit trail; matches the path
-- we'd take if there were data). fx_fee_pct → fx_fee_percent is a semantic
-- shift (1.0 vs 0.0100 to mean 1%), so handled as drop+add.
ALTER TABLE "payments" RENAME COLUMN "amount_source" TO "amount_received";
ALTER TABLE "payments" ALTER COLUMN "amount_received" SET DATA TYPE DECIMAL(14,2);

ALTER TABLE "payments" RENAME COLUMN "currency_source" TO "amount_received_currency";
-- Keep as VARCHAR(3) — matches the ISO-4217 currency constraint already
-- enforced on User.defaultCurrency / Client.defaultCurrency / Invoice.currency
-- (api-convention §5: currencies are always String @db.VarChar(3)).
ALTER TABLE "payments" ALTER COLUMN "amount_received_currency" SET DATA TYPE VARCHAR(3);

ALTER TABLE "payments" DROP COLUMN "fx_fee_pct";
-- fx_fee_percent stores a DECIMAL FRACTION, not a percentage:
--   1% fee → 0.0100   |   3% fee → 0.0300   |   100% fee → 1.0000
-- DECIMAL(5,4) holds up to 9.9999 as a number (999.99% in fraction terms),
-- way above any meaningful fee. The CHECK below is the real safety guard:
-- it pins the domain to [0, 1] so a misconfigured rate, or a future writer
-- that mistakenly stores a percent value (e.g. 8.0 for 8%), fails loudly
-- at INSERT instead of silently overflowing or corrupting downstream math.
-- DO NOT store the percent value — the CHECK will reject it.
ALTER TABLE "payments" ADD COLUMN "fx_fee_percent" DECIMAL(5,4) NOT NULL;
ALTER TABLE "payments" ADD CONSTRAINT "payments_fx_fee_percent_range_check"
  CHECK (fx_fee_percent BETWEEN 0 AND 1);

ALTER TABLE "payments" ADD COLUMN "user_id" UUID NOT NULL;
ALTER TABLE "payments" ADD COLUMN "stripe_payment_intent_id" TEXT NOT NULL;
ALTER TABLE "payments" ADD COLUMN "fx_fee_amount" DECIMAL(14,2) NOT NULL;
ALTER TABLE "payments" ADD COLUMN "stripe_fee_amount" DECIMAL(14,2);
ALTER TABLE "payments" ADD COLUMN "morph_tx_hash" TEXT;
-- DEFAULT 'pending' (not 'settling'): a fresh Payment row from the Stripe
-- webhook has not yet attempted any on-chain work. The TEA-76 sweep targets
-- 'settling' (genuinely in-flight) — defaulting to 'settling' would make
-- every brand-new payment look stuck, the sweep would resubmit, and the
-- freelancer's GCash would receive the amount twice.
ALTER TABLE "payments" ADD COLUMN "morph_tx_status" "morph_tx_status" NOT NULL DEFAULT 'pending';

-- payments never had updatedAt; add it per api-convention §5 ("createdAt,
-- updatedAt on every table"). NOT NULL with CURRENT_TIMESTAMP default is the
-- safe pattern: empty table → trivial; Prisma's @updatedAt then maintains
-- the value from the application side on each subsequent write.
ALTER TABLE "payments" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "payments" ALTER COLUMN "amount_php" SET DATA TYPE DECIMAL(14,2);
ALTER TABLE "payments" ALTER COLUMN "fx_rate" SET DATA TYPE DECIMAL(12,6);

-- AlterTable: payouts
-- Keeping updated_at (api-convention §5). failure_reason is dropped per spec
-- — TEA-76 surfaces failure context via logs until structured metadata is
-- needed.
ALTER TABLE "payouts" RENAME COLUMN "settled_at" TO "completed_at";
ALTER TABLE "payouts" DROP COLUMN "failure_reason";
ALTER TABLE "payouts" ALTER COLUMN "amount_php" SET DATA TYPE DECIMAL(14,2);

-- CreateIndex
CREATE UNIQUE INDEX "payments_stripe_payment_intent_id_key" ON "payments"("stripe_payment_intent_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_morph_tx_hash_key" ON "payments"("morph_tx_hash");

-- CreateIndex
CREATE INDEX "payments_user_id_paid_at_idx" ON "payments"("user_id", "paid_at" DESC);

-- CreateIndex
CREATE INDEX "payments_morph_tx_status_idx" ON "payments"("morph_tx_status");

-- Note: payments_invoice_id_idx and payouts_payout_method_id_idx are
-- intentionally preserved from the init migration (api-convention §5: index
-- every FK). Earlier drafts of this migration dropped them; the DROP
-- statements have been removed, so init's CREATE INDEX still owns these.

-- CreateIndex
CREATE UNIQUE INDEX "payouts_payment_id_key" ON "payouts"("payment_id");

-- CreateIndex
CREATE INDEX "payouts_status_idx" ON "payouts"("status");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
