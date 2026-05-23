import { Module } from "@nestjs/common";
import { CommonAuthModule } from "../../common/auth/auth.module";
import { InvoiceParserService } from "./invoice-parser.service";
import { InvoicesController } from "./invoices.controller";
import { InvoicesService } from "./invoices.service";

@Module({
  imports: [CommonAuthModule],
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoiceParserService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
