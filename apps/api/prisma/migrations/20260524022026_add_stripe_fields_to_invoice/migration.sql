-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "stripe_checkout_url" TEXT,
ADD COLUMN                             "public_share_token" TEXT,
ADD COLUMN                             "qr_code_data_url" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "invoices_public_share_token_key" ON "invoices"("public_share_token");