import { Controller } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { contract } from "@raket/contracts";
import { FxCompareService } from "./fx-compare.service";

// No AuthGuard — the FX calculator is public (TEA-51).
@Controller()
export class FxController {
  constructor(private readonly fxCompare: FxCompareService) {}

  @TsRestHandler(contract.fx.compare)
  compare() {
    return tsRestHandler(contract.fx.compare, async ({ query }) => {
      const comparison = await this.fxCompare.compare(query.usd);
      return { status: 200, body: comparison };
    });
  }
}
