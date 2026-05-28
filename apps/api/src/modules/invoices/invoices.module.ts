import { Module } from "@nestjs/common";
import { CommonAuthModule } from "../../common/auth/auth.module";
import { EmailModule } from "../integrations/email/email.module";
import { QrModule } from "../integrations/qr/qr.module";
import { StripeModule } from "../integrations/stripe/stripe.module";
import { InvoiceParserService } from "./invoice-parser.service";
import { InvoicesController } from "./invoices.controller";
import { InvoicesService } from "./invoices.service";

@Module({
  imports: [CommonAuthModule, StripeModule, QrModule, EmailModule],
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoiceParserService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
