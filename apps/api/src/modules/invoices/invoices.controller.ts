import { Controller, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { contract, QUOTATION_MAX_BYTES } from "@raket/contracts";
import { AuthGuard } from "../../common/auth/auth.guard";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import type { AuthUser } from "../../common/auth/auth-user.types";
import { InvoicesService } from "./invoices.service";

@UseGuards(AuthGuard)
@Controller()
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @TsRestHandler(contract.invoices.list)
  list(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.invoices.list, async ({ query }) => {
      const page = await this.invoices.list(user.id, query);
      return { status: 200, body: page };
    });
  }

  @TsRestHandler(contract.invoices.listItems)
  listItems(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.invoices.listItems, async ({ query }) => {
      const page = await this.invoices.listItems(user.id, query);
      return { status: 200, body: page };
    });
  }

  @TsRestHandler(contract.invoices.getById)
  getById(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.invoices.getById, async ({ params }) => {
      const invoice = await this.invoices.getById(user.id, params.invoiceId);
      return { status: 200, body: invoice };
    });
  }

  @TsRestHandler(contract.invoices.create)
  create(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.invoices.create, async ({ body }) => {
      const invoice = await this.invoices.create(user.id, body);
      return { status: 201, body: invoice };
    });
  }

  @TsRestHandler(contract.invoices.parseText)
  parseText(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.invoices.parseText, async ({ body }) => {
      const draft = await this.invoices.parseText(user.id, body);
      return { status: 200, body: draft };
    });
  }

  @TsRestHandler(contract.invoices.parseQuotation)
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: QUOTATION_MAX_BYTES } }))
  parseQuotation(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return tsRestHandler(contract.invoices.parseQuotation, async ({ body }) => {
      const draft = await this.invoices.parseQuotation(user.id, file, body);
      return { status: 200, body: draft };
    });
  }

  @TsRestHandler(contract.invoices.send)
  send(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.invoices.send, async ({ params, body }) => {
      const result = await this.invoices.send(user.id, params.invoiceId, body);
      return { status: 200, body: result };
    });
  }

  @TsRestHandler(contract.invoices.void)
  void(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.invoices.void, async ({ params }) => {
      const invoice = await this.invoices.void(user.id, params.invoiceId);
      return { status: 200, body: invoice };
    });
  }
}
