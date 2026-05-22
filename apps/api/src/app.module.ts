import { Module } from "@nestjs/common";
import { AppConfigModule } from "./common/config/config.module";
import { CommonAuthModule } from "./common/auth/auth.module";
import { HealthModule } from "./common/health/health.module";
import { PrismaModule } from "./common/prisma/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { GeminiModule } from "./modules/integrations/gemini/gemini.module";
import { InvoicesModule } from "./modules/invoices/invoices.module";

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    CommonAuthModule,
    HealthModule,
    GeminiModule,
    AuthModule,
    InvoicesModule,
  ],
})
export class AppModule {}
