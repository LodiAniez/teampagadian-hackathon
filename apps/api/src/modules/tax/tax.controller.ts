import {
  Controller,
  NotFoundException,
  UnprocessableEntityException,
  UseGuards,
} from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { contract, type BirElection } from "@raket/contracts";
import { AuthGuard } from "../../common/auth/auth.guard";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import type { AuthUser } from "../../common/auth/auth-user.types";
import { PrismaService } from "../../common/prisma/prisma.service";
import { TaxCalculatorService } from "./tax-calculator.service";

@UseGuards(AuthGuard)
@Controller()
export class TaxController {
  constructor(
    private readonly tax: TaxCalculatorService,
    private readonly prisma: PrismaService,
  ) {}

  @TsRestHandler(contract.tax.getQuarterly)
  getQuarterly(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.tax.getQuarterly, async ({ query }) => {
      const election = await this.resolveElection(user.id);
      const result = await this.tax.computeQuarterly(
        user.id,
        query.quarter as 1 | 2 | 3,
        query.year,
        election,
      );
      return { status: 200, body: result };
    });
  }

  @TsRestHandler(contract.tax.getAnnual)
  getAnnual(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.tax.getAnnual, async ({ query }) => {
      const election = await this.resolveElection(user.id);
      const result = await this.tax.computeAnnual(user.id, query.year, election);
      return { status: 200, body: result };
    });
  }

  private async resolveElection(userId: string): Promise<BirElection> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { bir2303Election: true },
    });
    if (!user) throw new NotFoundException("User not found");
    if (!user.bir2303Election) {
      throw new UnprocessableEntityException(
        "User has not selected a BIR regime; complete profile setup first",
      );
    }
    return user.bir2303Election;
  }
}
