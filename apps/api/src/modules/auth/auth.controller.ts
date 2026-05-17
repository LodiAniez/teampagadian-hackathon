import { Controller, UseGuards } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { contract } from "@raket/contracts";
import { AuthGuard } from "../../common/auth/auth.guard";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import type { AuthUser } from "../../common/auth/auth-user.types";
import { AuthService } from "./auth.service";

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @TsRestHandler(contract.auth.requestOtp)
  requestOtp() {
    return tsRestHandler(contract.auth.requestOtp, async ({ body }) => {
      const result = await this.auth.requestOtp(body);
      return { status: 200, body: result };
    });
  }

  @TsRestHandler(contract.auth.verifyOtp)
  verifyOtp() {
    return tsRestHandler(contract.auth.verifyOtp, async ({ body }) => {
      const session = await this.auth.verifyOtp(body);
      return { status: 200, body: session };
    });
  }

  @UseGuards(AuthGuard)
  @TsRestHandler(contract.auth.me)
  me(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.auth.me, async () => {
      const result = await this.auth.me(user.id);
      return { status: 200, body: result };
    });
  }

  @UseGuards(AuthGuard)
  @TsRestHandler(contract.auth.updateProfile)
  updateProfile(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.auth.updateProfile, async ({ body }) => {
      const result = await this.auth.updateProfile(user.id, body);
      return { status: 200, body: result };
    });
  }
}
