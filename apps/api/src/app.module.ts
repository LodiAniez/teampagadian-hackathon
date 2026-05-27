import { Module } from "@nestjs/common";
import { AppConfigModule } from "./common/config/config.module";
import { CommonAuthModule } from "./common/auth/auth.module";
import { HealthModule } from "./common/health/health.module";
import { PrismaModule } from "./common/prisma/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { EmailModule } from "./modules/integrations/email/email.module";
import { FxModule } from "./modules/integrations/fx/fx.module";
import { GeminiModule } from "./modules/integrations/gemini/gemini.module";
import { QrModule } from "./modules/integrations/qr/qr.module";
import { StripeModule } from "./modules/integrations/stripe/stripe.module";
import { InvoicesModule } from "./modules/invoices/invoices.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { PayoutMethodsModule } from "./modules/payout-methods/payout-methods.module";

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    CommonAuthModule,
    HealthModule,
    GeminiModule,
    AuthModule,
    FxModule,
    StripeModule,
    QrModule,
    EmailModule,
    PaymentsModule,
    InvoicesModule,
    PayoutMethodsModule,
  ],
})
export class AppModule {}
