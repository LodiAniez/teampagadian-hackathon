import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { AppConfigModule } from "./common/config/config.module";
import { CommonAuthModule } from "./common/auth/auth.module";
import { HealthModule } from "./common/health/health.module";
import { PrismaModule } from "./common/prisma/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { EmailModule } from "./modules/integrations/email/email.module";
import { FxModule } from "./modules/integrations/fx/fx.module";
import { GeminiModule } from "./modules/integrations/gemini/gemini.module";
import { QrModule } from "./modules/integrations/qr/qr.module";
import { StripeWebhookModule } from "./modules/integrations/stripe/stripe-webhook.module";
import { InvoicesModule } from "./modules/invoices/invoices.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { PayoutMethodsModule } from "./modules/payout-methods/payout-methods.module";
import { SettlementModule } from "./modules/settlement/settlement.module";
import { TaxModule } from "./modules/tax/tax.module";

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    ScheduleModule.forRoot(),
    CommonAuthModule,
    HealthModule,
    GeminiModule,
    AuthModule,
    FxModule,
    StripeWebhookModule,
    QrModule,
    EmailModule,
    PaymentsModule,
    InvoicesModule,
    PayoutMethodsModule,
    SettlementModule,
    DashboardModule,
    TaxModule,
  ],
})
export class AppModule {}
