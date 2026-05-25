-- CreateEnum
CREATE TYPE "morph_tx_status" AS ENUM ('settling', 'settled', 'failed');

-- AlterEnum
-- Swap PayoutStatus to PENDING | PROCESSING | DELIVERED | FAILED.
-- `succeeded` is removed (no rows exist; PaymentsService is still a stub).
-- `processing` + `delivered` are added so the (mocked) Coins.ph leg has
-- in-flight + landed states distinct from on-chain settlement.
-- No inner BEGIN/COMMIT here: Prisma wraps each migration file in a
-- transaction, so an explicit COMMIT would close the outer tx early and
-- leave statements below running in auto-commit.
CREATE TYPE "payout_status_new" AS ENUM ('pending', 'processing', 'delivered', 'failed');
ALTER TABLE "public"."payouts" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "payouts" ALTER COLUMN "status" TYPE "payout_status_new" USING ("status"::text::"payout_status_new");
ALTER TYPE "payout_status" RENAME TO "payout_status_old";
ALTER TYPE "payout_status_new" RENAME TO "payout_status";
DROP TYPE "public"."payout_status_old";
ALTER TABLE "payouts" ALTER COLUMN "status" SET DEFAULT 'pending';

-- DropIndex
DROP INDEX "payments_invoice_id_idx";

-- DropIndex
DROP INDEX "payments_stripe_charge_id_key";

-- DropIndex
DROP INDEX "payouts_payment_id_idx";

-- DropIndex
DROP INDEX "payouts_payout_method_id_idx";

-- AlterTable: payments
-- Renames preserved as RENAME COLUMN (clean audit trail; matches the path
-- we'd take if there were data). fx_fee_pct → fx_fee_percent is a semantic
-- shift (1.0 vs 0.0100 to mean 1%), so handled as drop+add.
ALTER TABLE "payments" RENAME COLUMN "amount_source" TO "amount_received";
ALTER TABLE "payments" ALTER COLUMN "amount_received" SET DATA TYPE DECIMAL(14,2);

ALTER TABLE "payments" RENAME COLUMN "currency_source" TO "amount_received_currency";
ALTER TABLE "payments" ALTER COLUMN "amount_received_currency" SET DATA TYPE TEXT;

ALTER TABLE "payments" DROP COLUMN "fx_fee_pct";
ALTER TABLE "payments" ADD COLUMN "fx_fee_percent" DECIMAL(5,4) NOT NULL;

ALTER TABLE "payments" ADD COLUMN "user_id" UUID NOT NULL;
ALTER TABLE "payments" ADD COLUMN "stripe_payment_intent_id" TEXT NOT NULL;
ALTER TABLE "payments" ADD COLUMN "fx_fee_amount" DECIMAL(14,2) NOT NULL;
ALTER TABLE "payments" ADD COLUMN "stripe_fee_amount" DECIMAL(14,2);
ALTER TABLE "payments" ADD COLUMN "morph_tx_hash" TEXT;
ALTER TABLE "payments" ADD COLUMN "morph_tx_status" "morph_tx_status" NOT NULL DEFAULT 'settling';

ALTER TABLE "payments" ALTER COLUMN "amount_php" SET DATA TYPE DECIMAL(14,2);
ALTER TABLE "payments" ALTER COLUMN "fx_rate" SET DATA TYPE DECIMAL(12,6);

-- AlterTable: payouts
ALTER TABLE "payouts" RENAME COLUMN "settled_at" TO "completed_at";
ALTER TABLE "payouts" DROP COLUMN "failure_reason";
ALTER TABLE "payouts" DROP COLUMN "updated_at";
ALTER TABLE "payouts" ALTER COLUMN "amount_php" SET DATA TYPE DECIMAL(14,2);

-- CreateIndex
CREATE UNIQUE INDEX "payments_stripe_payment_intent_id_key" ON "payments"("stripe_payment_intent_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_morph_tx_hash_key" ON "payments"("morph_tx_hash");

-- CreateIndex
CREATE INDEX "payments_user_id_paid_at_idx" ON "payments"("user_id", "paid_at" DESC);

-- CreateIndex
CREATE INDEX "payments_morph_tx_status_idx" ON "payments"("morph_tx_status");

-- CreateIndex
CREATE UNIQUE INDEX "payouts_payment_id_key" ON "payouts"("payment_id");

-- CreateIndex
CREATE INDEX "payouts_status_idx" ON "payouts"("status");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
