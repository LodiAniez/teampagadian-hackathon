-- CreateEnum
CREATE TYPE "payout_method_type" AS ENUM ('card', 'gcash', 'maya', 'bank_account');

-- AlterTable
ALTER TABLE "payout_methods"
  ALTER COLUMN "type" TYPE "payout_method_type"
  USING "type"::"payout_method_type";
