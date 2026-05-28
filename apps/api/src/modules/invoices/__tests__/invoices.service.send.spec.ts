import { ConflictException, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SendInvoiceBody } from "@raket/contracts";
import { PrismaService } from "../../../common/prisma/prisma.service";
import { EmailService } from "../../integrations/email/email.service";
import { QrService } from "../../integrations/qr/qr.service";
import { StripeService } from "../../integrations/stripe/stripe.service";
import { InvoiceParserService } from "../invoice-parser.service";
import { InvoicesService } from "../invoices.service";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const INVOICE_ID = "11111111-1111-1111-1111-111111111111";
const USER_ID = "22222222-2222-2222-2222-222222222222";
const CLIENT_ID = "33333333-3333-3333-3333-333333333333";
const CHECKOUT_URL = "https://checkout.stripe.com/c/pay/cs_test_abc";
const QR_DATA_URL = "data:image/png;base64,iVBORw0KGgo=";

function buildInvoiceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: INVOICE_ID,
    userId: USER_ID,
    clientId: CLIENT_ID,
    number: "INV-2026-0001",
    status: "draft",
    amount: { toString: () => "1500.00", valueOf: () => 1500 },
    currency: "USD",
    issueDate: new Date("2026-05-01"),
    dueDate: new Date("2026-05-31"),
    sourceType: "text",
    stripeCheckoutSessionId: null,
    stripeCheckoutUrl: null,
    publicShareToken: null,
    qrCodeDataUrl: null,
    sentAt: null,
    stripePaymentIntentId: null,
    createdAt: new Date("2026-05-01T00:00:00Z"),
    updatedAt: new Date("2026-05-01T00:00:00Z"),
    client: {
      id: CLIENT_ID,
      userId: USER_ID,
      name: "Acme Corp",
      email: "ap@acme.com",
      country: "US",
      defaultCurrency: "USD",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    lineItems: [
      {
        id: "li-1",
        invoiceId: INVOICE_ID,
        description: "UI design",
        quantity: { toString: () => "20", valueOf: () => 20 },
        unit: "hours",
        rate: { toString: () => "75.00", valueOf: () => 75 },
        amount: { toString: () => "1500.00", valueOf: () => 1500 },
        position: 0,
      },
    ],
    ...overrides,
  };
}

function buildFreelancer(overrides: Record<string, unknown> = {}) {
  return {
    id: USER_ID,
    supabaseUserId: null,
    phone: "+639171234567",
    name: "Juan dela Cruz",
    businessName: "Juan's Studio",
    defaultCurrency: "USD",
    defaultHourlyRate: null,
    bir2303Election: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const SEND_BODY: SendInvoiceBody = { clientEmail: "ap@acme.com" };

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

describe("InvoicesService.send", () => {
  let service: InvoicesService;
  let mockPrisma: {
    invoice: {
      findFirst: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
    user: { findUnique: ReturnType<typeof vi.fn> };
  };
  let mockStripe: { createInvoiceCheckoutSession: ReturnType<typeof vi.fn> };
  let mockQr: { toDataUrl: ReturnType<typeof vi.fn> };
  let mockEmail: { sendInvoiceEmail: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockPrisma = {
      invoice: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
      user: { findUnique: vi.fn() },
    };
    mockStripe = { createInvoiceCheckoutSession: vi.fn() };
    mockQr = { toDataUrl: vi.fn() };
    mockEmail = { sendInvoiceEmail: vi.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: InvoiceParserService, useValue: {} },
        { provide: StripeService, useValue: mockStripe },
        { provide: QrService, useValue: mockQr },
        { provide: EmailService, useValue: mockEmail },
        {
          provide: ConfigService,
          useValue: { get: vi.fn(() => "https://app.raket.ph") },
        },
      ],
    }).compile();

    service = moduleRef.get(InvoicesService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------

  it("sends a draft invoice end-to-end and returns checkoutUrl + qrCodeDataUrl", async () => {
    const row = buildInvoiceRow();
    const updatedRow = buildInvoiceRow({
      status: "sent",
      stripeCheckoutUrl: CHECKOUT_URL,
      qrCodeDataUrl: QR_DATA_URL,
    });
    mockPrisma.invoice.findFirst.mockResolvedValue(row);
    mockPrisma.invoice.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.user.findUnique.mockResolvedValue(buildFreelancer());
    mockStripe.createInvoiceCheckoutSession.mockResolvedValue({
      id: "cs_test_abc",
      url: CHECKOUT_URL,
    });
    mockQr.toDataUrl.mockResolvedValue(QR_DATA_URL);
    mockEmail.sendInvoiceEmail.mockResolvedValue({ id: "re_abc" });
    mockPrisma.invoice.update.mockResolvedValue(updatedRow);

    const result = await service.send(USER_ID, INVOICE_ID, SEND_BODY);

    expect(result.checkoutUrl).toBe(CHECKOUT_URL);
    expect(result.qrCodeDataUrl).toBe(QR_DATA_URL);
    expect(result.invoice.status).toBe("sent");
    expect(mockPrisma.invoice.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: INVOICE_ID, userId: USER_ID, status: "draft", sentAt: null },
      }),
    );
    expect(mockPrisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: INVOICE_ID },
        data: expect.objectContaining({ status: "sent", stripeCheckoutUrl: CHECKOUT_URL }),
      }),
    );
    expect(mockEmail.sendInvoiceEmail).toHaveBeenCalledWith(
      expect.objectContaining({ recipientEmail: "ap@acme.com" }),
    );
    const emailPayload = mockEmail.sendInvoiceEmail.mock.calls[0][0];
    expect(emailPayload.freelancer).not.toHaveProperty("contactEmail");
  });

  it("loses the lock race and returns the winner's cached Stripe/QR data without creating a new session", async () => {
    const draftRow = buildInvoiceRow();
    const wonRow = buildInvoiceRow({
      status: "sent",
      stripeCheckoutUrl: CHECKOUT_URL,
      qrCodeDataUrl: QR_DATA_URL,
    });
    // Two findFirst calls: first sees draft (pre-lock), second sees the
    // winner's already-persisted sent row.
    mockPrisma.invoice.findFirst.mockResolvedValueOnce(draftRow).mockResolvedValueOnce(wonRow);
    mockPrisma.invoice.updateMany.mockResolvedValue({ count: 0 });

    const result = await service.send(USER_ID, INVOICE_ID, SEND_BODY);

    expect(result.checkoutUrl).toBe(CHECKOUT_URL);
    expect(result.qrCodeDataUrl).toBe(QR_DATA_URL);
    expect(mockStripe.createInvoiceCheckoutSession).not.toHaveBeenCalled();
    expect(mockEmail.sendInvoiceEmail).not.toHaveBeenCalled();
    expect(mockPrisma.invoice.update).not.toHaveBeenCalled();
  });

  it("throws ConflictException when the lock is lost mid-flight (winner has not finished)", async () => {
    const draftRow = buildInvoiceRow();
    const inFlightRow = buildInvoiceRow({ sentAt: new Date() });
    mockPrisma.invoice.findFirst.mockResolvedValueOnce(draftRow).mockResolvedValueOnce(inFlightRow);
    mockPrisma.invoice.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.send(USER_ID, INVOICE_ID, SEND_BODY)).rejects.toThrow(ConflictException);
    expect(mockStripe.createInvoiceCheckoutSession).not.toHaveBeenCalled();
  });

  it("returns existing data without re-creating a Stripe session when already sent", async () => {
    const row = buildInvoiceRow({
      status: "sent",
      stripeCheckoutUrl: CHECKOUT_URL,
      qrCodeDataUrl: QR_DATA_URL,
    });
    mockPrisma.invoice.findFirst.mockResolvedValue(row);

    const result = await service.send(USER_ID, INVOICE_ID, SEND_BODY);

    expect(result.checkoutUrl).toBe(CHECKOUT_URL);
    expect(result.qrCodeDataUrl).toBe(QR_DATA_URL);
    expect(mockStripe.createInvoiceCheckoutSession).not.toHaveBeenCalled();
    expect(mockEmail.sendInvoiceEmail).not.toHaveBeenCalled();
  });

  it("throws ConflictException when invoice is paid", async () => {
    mockPrisma.invoice.findFirst.mockResolvedValue(buildInvoiceRow({ status: "paid" }));

    await expect(service.send(USER_ID, INVOICE_ID, SEND_BODY)).rejects.toThrow(ConflictException);
  });

  it("throws NotFoundException when invoice does not belong to the user", async () => {
    mockPrisma.invoice.findFirst.mockResolvedValue(null);

    await expect(service.send(USER_ID, INVOICE_ID, SEND_BODY)).rejects.toThrow(NotFoundException);
  });

  it("still returns success when email send fails — Stripe session is already persisted", async () => {
    const row = buildInvoiceRow();
    const updatedRow = buildInvoiceRow({
      status: "sent",
      stripeCheckoutUrl: CHECKOUT_URL,
      qrCodeDataUrl: QR_DATA_URL,
    });
    mockPrisma.invoice.findFirst.mockResolvedValue(row);
    mockPrisma.invoice.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.user.findUnique.mockResolvedValue(buildFreelancer());
    mockStripe.createInvoiceCheckoutSession.mockResolvedValue({
      id: "cs_test_abc",
      url: CHECKOUT_URL,
    });
    mockQr.toDataUrl.mockResolvedValue(QR_DATA_URL);
    mockEmail.sendInvoiceEmail.mockRejectedValue(new Error("Resend down"));
    mockPrisma.invoice.update.mockResolvedValue(updatedRow);

    const result = await service.send(USER_ID, INVOICE_ID, SEND_BODY);

    expect(result.checkoutUrl).toBe(CHECKOUT_URL);
    expect(result.invoice.status).toBe("sent");
  });

  it("throws InternalServerErrorException when a sent invoice is missing Stripe/QR data", async () => {
    mockPrisma.invoice.findFirst.mockResolvedValue(
      buildInvoiceRow({ status: "sent", stripeCheckoutUrl: null, qrCodeDataUrl: null }),
    );

    await expect(service.send(USER_ID, INVOICE_ID, SEND_BODY)).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
