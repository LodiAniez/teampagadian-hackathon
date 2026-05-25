import { Module } from "@nestjs/common";
import { CommonAuthModule } from "../../common/auth/auth.module";
import { StripeModule } from "../integrations/stripe/stripe.module";
import { PayoutMethodsController } from "./payout-methods.controller";
import { PayoutMethodsService } from "./payout-methods.service";

@Module({
  imports: [CommonAuthModule, StripeModule],
  controllers: [PayoutMethodsController],
  providers: [PayoutMethodsService],
  exports: [PayoutMethodsService],
})
export class PayoutMethodsModule {}
