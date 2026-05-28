import { Test } from "@nestjs/testing";
import { ExecutionContext, INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthGuard } from "../../../common/auth/auth.guard";
import { TsRestExceptionFilter } from "../../../common/filters/ts-rest-exception.filter";
import { InvoicesController } from "../invoices.controller";
import { InvoicesService } from "../invoices.service";

const userId = "00000000-0000-0000-0000-000000000001";

const draft = {
  clientName: "Quotation Source",
  clientEmail: null,
  currency: "USD" as const,
  issueDate: "2026-05-22",
  dueDate: "2026-06-21",
  lineItems: [],
  warnings: [],
};

class PassThroughAuthGuard {
  canActivate(ctx: ExecutionContext): boolean {
    ctx.switchToHttp().getRequest().user = { id: userId, phone: "+15555550100" };
    return true;
  }
}

describe("InvoicesController.parseQuotation", () => {
  let app: INestApplication;
  const parseQuotation = vi.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [InvoicesController],
      providers: [{ provide: InvoicesService, useValue: { parseQuotation } }],
    })
      .overrideGuard(AuthGuard)
      .useClass(PassThroughAuthGuard)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new TsRestExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    parseQuotation.mockReset();
  });

  it("accepts a PDF file and returns 200 with the parsed draft", async () => {
    parseQuotation.mockResolvedValue(draft);

    const res = await request(app.getHttpServer())
      .post("/api/v1/invoices/parse-quotation")
      .set("Authorization", "Bearer test-token")
      .attach("file", Buffer.from("%PDF-1.4 fake content"), {
        filename: "quotation.pdf",
        contentType: "application/pdf",
      })
      .field("defaultCurrency", "PHP");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(draft);
    expect(parseQuotation).toHaveBeenCalledTimes(1);
    const [calledUserId, file, body] = parseQuotation.mock.calls[0];
    expect(calledUserId).toBe(userId);
    expect(file?.mimetype).toBe("application/pdf");
    expect(file?.buffer).toBeInstanceOf(Buffer);
    expect(body).toEqual({ defaultCurrency: "PHP" });
  });

  it("accepts the request without defaultCurrency", async () => {
    parseQuotation.mockResolvedValue(draft);

    const res = await request(app.getHttpServer())
      .post("/api/v1/invoices/parse-quotation")
      .set("Authorization", "Bearer test-token")
      .attach("file", Buffer.from("%PDF-1.4"), {
        filename: "q.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(200);
    const [, , body] = parseQuotation.mock.calls[0];
    expect(body.defaultCurrency).toBeUndefined();
  });

  it("returns 413 when the uploaded file exceeds the 5 MB limit", async () => {
    parseQuotation.mockResolvedValue(draft);
    const bigBuffer = Buffer.alloc(5 * 1024 * 1024 + 10, "x");

    const res = await request(app.getHttpServer())
      .post("/api/v1/invoices/parse-quotation")
      .set("Authorization", "Bearer test-token")
      .attach("file", bigBuffer, { filename: "big.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(413);
    expect(res.body.code).toBe("FILE_TOO_LARGE");
    expect(parseQuotation).not.toHaveBeenCalled();
  });

  it("returns 415 when the file MIME type is not allowed", async () => {
    parseQuotation.mockImplementation(async (_userId, file) => {
      // Simulate the real service call: the service layer is what raises 415.
      const { UnsupportedMediaTypeException } = await import("@nestjs/common");
      throw new UnsupportedMediaTypeException(`Unsupported file type: ${file.mimetype}`);
    });

    const res = await request(app.getHttpServer())
      .post("/api/v1/invoices/parse-quotation")
      .set("Authorization", "Bearer test-token")
      .attach("file", Buffer.from("hello"), {
        filename: "note.txt",
        contentType: "text/plain",
      });

    expect(res.status).toBe(415);
  });

  it("returns 422 when no file field is present in the multipart body", async () => {
    parseQuotation.mockImplementation(async (_userId, file) => {
      const { UnprocessableEntityException } = await import("@nestjs/common");
      if (!file) throw new UnprocessableEntityException("file is required");
      return draft;
    });

    const res = await request(app.getHttpServer())
      .post("/api/v1/invoices/parse-quotation")
      .set("Authorization", "Bearer test-token")
      .field("defaultCurrency", "USD");

    expect(res.status).toBe(422);
  });
});
