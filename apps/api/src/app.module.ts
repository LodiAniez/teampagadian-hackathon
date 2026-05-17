import { Module } from "@nestjs/common";
import { AppConfigModule } from "./common/config/config.module";
import { CommonAuthModule } from "./common/auth/auth.module";
import { PrismaModule } from "./common/prisma/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { InvoicesModule } from "./modules/invoices/invoices.module";

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    CommonAuthModule,
    AuthModule,
    InvoicesModule,
  ],
})
export class AppModule {}
