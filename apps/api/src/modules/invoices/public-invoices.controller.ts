import { Controller } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { contract } from "@raket/contracts";
import { InvoicesService } from "./invoices.service";

// Public sibling to InvoicesController — no AuthGuard. The 16-byte share token
// in the URL is the capability. See docs/api-convention.md §8 for the
// "integration controller in an otherwise auth-guarded module" pattern
// (mirrors StripeWebhookController).
@Controller()
export class PublicInvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @TsRestHandler(contract.publicInvoices.getByToken)
  getByToken() {
    return tsRestHandler(contract.publicInvoices.getByToken, async ({ params }) => {
      const invoice = await this.invoices.getByPublicToken(params.token);
      return { status: 200, body: invoice };
    });
  }
}
