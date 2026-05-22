import { Module } from "@nestjs/common";
import { AppConfigModule } from "./common/config/config.module";
import { CommonAuthModule } from "./common/auth/auth.module";
import { HealthModule } from "./common/health/health.module";
import { PrismaModule } from "./common/prisma/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { FxModule } from "./modules/integrations/fx/fx.module";
import { StripeModule } from "./modules/integrations/stripe/stripe.module";
import { InvoicesModule } from "./modules/invoices/invoices.module";

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    CommonAuthModule,
    HealthModule,
    AuthModule,
    FxModule,
    StripeModule,
    InvoicesModule,
  ],
})
export class AppModule {}
