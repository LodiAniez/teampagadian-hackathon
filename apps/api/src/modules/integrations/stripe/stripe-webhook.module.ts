import { Module } from "@nestjs/common";
import { PaymentsModule } from "../../payments/payments.module";
import { StripeWebhookController } from "./stripe-webhook.controller";
import { StripeModule } from "./stripe.module";

/**
 * Owns the Stripe-driven inbound HTTP surface. Kept separate from
 * `StripeModule` (which exports `StripeService`) so the payments slice can
 * import `StripeModule` for the poller without re-introducing the
 * StripeModule ↔ PaymentsModule cycle the webhook controller used to create.
 */
@Module({
  imports: [StripeModule, PaymentsModule],
  controllers: [StripeWebhookController],
})
export class StripeWebhookModule {}
