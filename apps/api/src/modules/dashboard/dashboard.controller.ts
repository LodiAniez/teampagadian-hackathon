import { Controller, UseGuards } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { contract } from "@raket/contracts";
import { AuthGuard } from "../../common/auth/auth.guard";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import type { AuthUser } from "../../common/auth/auth-user.types";
import { DashboardService } from "./dashboard.service";

@UseGuards(AuthGuard)
@Controller()
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @TsRestHandler(contract.dashboard.getSummary)
  getSummary(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.dashboard.getSummary, async () => {
      const summary = await this.dashboard.getSummary(user.id);
      return { status: 200, body: summary };
    });
  }

  @TsRestHandler(contract.dashboard.getEarningsByMonth)
  getEarningsByMonth(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.dashboard.getEarningsByMonth, async ({ query }) => {
      const rows = await this.dashboard.getEarningsByMonth(user.id, query.months);
      return { status: 200, body: rows };
    });
  }

  @TsRestHandler(contract.dashboard.getEarningsByClient)
  getEarningsByClient(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.dashboard.getEarningsByClient, async ({ query }) => {
      const rows = await this.dashboard.getEarningsByClient(user.id, query.limit);
      return { status: 200, body: rows };
    });
  }

  @TsRestHandler(contract.dashboard.getEarningsByCountry)
  getEarningsByCountry(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.dashboard.getEarningsByCountry, async () => {
      const rows = await this.dashboard.getEarningsByCountry(user.id);
      return { status: 200, body: rows };
    });
  }
}
