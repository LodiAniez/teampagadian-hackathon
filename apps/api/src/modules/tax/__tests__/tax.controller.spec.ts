import { Test } from "@nestjs/testing";
import { ExecutionContext, INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthGuard } from "../../../common/auth/auth.guard";
import { TsRestExceptionFilter } from "../../../common/filters/ts-rest-exception.filter";
import { PrismaService } from "../../../common/prisma/prisma.service";
import { TaxCalculatorService } from "../tax-calculator.service";
import { TaxController } from "../tax.controller";

const USER_ID = "00000000-0000-0000-0000-000000000001";

class PassThroughAuthGuard {
  canActivate(ctx: ExecutionContext): boolean {
    ctx.switchToHttp().getRequest().user = { id: USER_ID, phone: "+639171234567" };
    return true;
  }
}

describe("TaxController", () => {
  let app: INestApplication;
  const computeQuarterly = vi.fn();
  const computeAnnual = vi.fn();
  const findUnique = vi.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TaxController],
      providers: [
        { provide: TaxCalculatorService, useValue: { computeQuarterly, computeAnnual } },
        { provide: PrismaService, useValue: { user: { findUnique } } },
      ],
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
    computeQuarterly.mockReset();
    computeAnnual.mockReset();
    findUnique.mockReset();
  });

  it("returns 200 + the computed quarterly result for a user with an election set", async () => {
    findUnique.mockResolvedValue({ bir2303Election: "EIGHT_PERCENT" });
    const computed = {
      grossReceiptsPhp: 487_250,
      election: "EIGHT_PERCENT" as const,
      taxDuePhp: 38_980,
      formCode: "1701Q" as const,
      formName: "Quarterly Income Tax Return",
      deadline: "2026-05-15",
      breakdown: "₱487,250 × 8% = ₱38,980",
      invoiceCount: 3,
      paymentBreakdown: [],
    };
    computeQuarterly.mockResolvedValue(computed);

    const res = await request(app.getHttpServer())
      .get("/api/v1/tax/quarterly?quarter=1&year=2026")
      .set("Authorization", "Bearer test-token");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(computed);
    expect(computeQuarterly).toHaveBeenCalledWith(USER_ID, 1, 2026, "EIGHT_PERCENT");
  });

  it("returns 422 when the user has no bir2303Election set", async () => {
    findUnique.mockResolvedValue({ bir2303Election: null });

    const res = await request(app.getHttpServer())
      .get("/api/v1/tax/annual?year=2026")
      .set("Authorization", "Bearer test-token");

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("VALIDATION_FAILED");
    expect(computeAnnual).not.toHaveBeenCalled();
  });

  it("returns 404 when the user record is missing", async () => {
    findUnique.mockResolvedValue(null);

    const res = await request(app.getHttpServer())
      .get("/api/v1/tax/quarterly?quarter=2&year=2026")
      .set("Authorization", "Bearer test-token");

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
    expect(computeQuarterly).not.toHaveBeenCalled();
  });
});
