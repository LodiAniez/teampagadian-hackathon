CREATE UNIQUE INDEX "payout_methods_one_default_per_user"
  ON "payout_methods" ("user_id") WHERE "is_default" = true;