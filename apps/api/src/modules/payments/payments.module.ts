import { Module } from "@nestjs/common";
import { FxModule } from "../integrations/fx/fx.module";
import { StripeModule } from "../integrations/stripe/stripe.module";
import { PayoutsModule } from "../payouts/payouts.module";
import { SettlementModule } from "../settlement/settlement.module";
import { PaymentIntentPoller } from "./payment-intent-poller";
import { PaymentsService } from "./payments.service";

@Module({
  imports: [FxModule, SettlementModule, PayoutsModule, StripeModule],
  providers: [PaymentsService, PaymentIntentPoller],
  exports: [PaymentsService],
})
export class PaymentsModule {}
