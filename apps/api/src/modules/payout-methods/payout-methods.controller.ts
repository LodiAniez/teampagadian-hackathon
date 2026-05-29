import { Controller, UseGuards } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { contract } from "@raket/contracts";
import { AuthGuard } from "../../common/auth/auth.guard";
import { FreshAuthGuard } from "../../common/auth/fresh-auth.guard";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import type { AuthUser } from "../../common/auth/auth-user.types";
import { PayoutMethodsService } from "./payout-methods.service";

@Controller()
export class PayoutMethodsController {
  constructor(private readonly payoutMethods: PayoutMethodsService) {}

  @UseGuards(AuthGuard)
  @TsRestHandler(contract.payoutMethods.list)
  list(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.payoutMethods.list, async () => {
      const methods = await this.payoutMethods.list(user.id);
      return { status: 200, body: methods };
    });
  }

  @UseGuards(FreshAuthGuard)
  @TsRestHandler(contract.payoutMethods.add)
  add(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.payoutMethods.add, async ({ body }) => {
      const method = await this.payoutMethods.add(user.id, body);
      return { status: 201, body: method };
    });
  }

  // AuthGuard (not FreshAuthGuard) — the SetupIntent itself is harmless
  // (server-side Stripe object creation). FreshAuthGuard sits on POST /
  // (the add call), which is where the new payout method actually lands
  // in the DB. Gating setup-intent too would force the user to re-OTP
  // before the PaymentSheet even opens, which is the wrong UX.
  @UseGuards(AuthGuard)
  @TsRestHandler(contract.payoutMethods.setupIntent)
  setupIntent(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.payoutMethods.setupIntent, async () => {
      const result = await this.payoutMethods.createSetupIntent(user.id);
      return { status: 200, body: result };
    });
  }

  @UseGuards(FreshAuthGuard)
  @TsRestHandler(contract.payoutMethods.setDefault)
  setDefault(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.payoutMethods.setDefault, async ({ params }) => {
      const method = await this.payoutMethods.setDefault(user.id, params.id);
      return { status: 200, body: method };
    });
  }

  @UseGuards(FreshAuthGuard)
  @TsRestHandler(contract.payoutMethods.remove)
  remove(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.payoutMethods.remove, async ({ params }) => {
      await this.payoutMethods.remove(user.id, params.id);
      return { status: 204, body: undefined };
    });
  }
}
