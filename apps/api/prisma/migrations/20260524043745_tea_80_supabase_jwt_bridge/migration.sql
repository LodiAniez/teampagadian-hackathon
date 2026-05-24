-- AlterTable: add nullable Supabase user id link on users
ALTER TABLE "users" ADD COLUMN "supabase_user_id" UUID;

-- CreateIndex: unique constraint on the Supabase user id link
CREATE UNIQUE INDEX "users_supabase_user_id_key" ON "users"("supabase_user_id");

-- DropTable: OTP challenges are now Supabase's responsibility
DROP TABLE "otp_challenges";
