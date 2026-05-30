import { Module } from "@nestjs/common";
import { CommonAuthModule } from "../../common/auth/auth.module";
import { TaxCalculatorService } from "./tax-calculator.service";
import { TaxController } from "./tax.controller";

@Module({
  imports: [CommonAuthModule],
  controllers: [TaxController],
  providers: [TaxCalculatorService],
  exports: [TaxCalculatorService],
})
export class TaxModule {}
