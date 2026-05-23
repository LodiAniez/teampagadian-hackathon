/*
  Warnings:

  - A unique constraint covering the columns `[user_id,number]` on the table `invoices` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `number` to the `invoices` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "number" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "invoices_user_id_status_idx" ON "invoices"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_user_id_number_key" ON "invoices"("user_id", "number");
