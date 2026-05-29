import { Test } from "@nestjs/testing";
import { INestApplication, NotFoundException } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicInvoiceResponse } from "@raket/contracts";
import { TsRestExceptionFilter } from "../../../common/filters/ts-rest-exception.filter";
import { InvoicesService } from "../invoices.service";
import { PublicInvoicesController } from "../public-invoices.controller";

const SHARE_TOKEN = "shareTokenAbc123";

const publicDto: PublicInvoiceResponse = {
  number: "INV-2026-0001",
  status: "sent",
  amount: 1500,
  currency: "USD",
  issueDate: "2026-05-01",
  dueDate: "2026-05-31",
  freelancer: { name: "Juan dela Cruz", businessName: "Juan's Studio" },
  client: { name: "Acme Co." },
  lineItems: [{ description: "UI design", quantity: 20, unit: "hours", rate: 75, amount: 1500 }],
  stripeCheckoutUrl: "https://checkout.stripe.com/c/pay/cs_test_abc",
  qrCodeDataUrl: "data:image/png;base64,iVBORw0KGgo=",
  token: SHARE_TOKEN,
};

describe("PublicInvoicesController.getByToken", () => {
  let app: INestApplication;
  const getByPublicToken = vi.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PublicInvoicesController],
      providers: [{ provide: InvoicesService, useValue: { getByPublicToken } }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new TsRestExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    getByPublicToken.mockReset();
  });

  it("returns 200 with the sanitized DTO for a valid token (no Authorization header required)", async () => {
    getByPublicToken.mockResolvedValue(publicDto);

    const res = await request(app.getHttpServer()).get(`/api/v1/public/invoices/${SHARE_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(publicDto);
    expect(getByPublicToken).toHaveBeenCalledWith(SHARE_TOKEN);
  });

  it("returns 404 when the service raises NotFoundException", async () => {
    getByPublicToken.mockRejectedValue(new NotFoundException("Invoice not found"));

    const res = await request(app.getHttpServer()).get("/api/v1/public/invoices/missing-token");

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });
});
