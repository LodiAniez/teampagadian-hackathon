import { Module } from "@nestjs/common";
import { FxModule as FxRateModule } from "../integrations/fx/fx.module";
import { FxCompareService } from "./fx-compare.service";
import { FxController } from "./fx.controller";

@Module({
  imports: [FxRateModule],
  controllers: [FxController],
  providers: [FxCompareService],
})
export class FxCompareModule {}
