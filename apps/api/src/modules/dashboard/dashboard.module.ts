import { Module } from "@nestjs/common";
import { CommonAuthModule } from "../../common/auth/auth.module";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";

@Module({
  imports: [CommonAuthModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
