import { Module } from "@nestjs/common";
import { FxModule } from "../integrations/fx/fx.module";
import { PayoutsModule } from "../payouts/payouts.module";
import { SettlementModule } from "../settlement/settlement.module";
import { PaymentsService } from "./payments.service";

@Module({
  imports: [FxModule, SettlementModule, PayoutsModule],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
