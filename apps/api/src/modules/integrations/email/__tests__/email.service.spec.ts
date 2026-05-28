import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EmailService } from "../email.service";
import { RESEND_CLIENT, type ResendClient, type SendInvoiceEmailParams } from "../email.types";

function buildParams(overrides: Partial<SendInvoiceEmailParams> = {}): SendInvoiceEmailParams {
  return {
    invoice: {
      number: "INV-2026-0001",
      amount: "1,500.00",
      currency: "USD",
      dueDate: "May 30, 2026",
      clientName: "Acme Corp",
      lineItems: [
        { description: "Landing page design", amount: "1,200.00" },
        { description: "Brand kit", amount: "300.00" },
      ],
    },
    freelancer: {
      displayName: "Juan's Studio",
      name: "Juan dela Cruz",
      businessName: "Juan's Studio",
      contactEmail: "juan@juanstudio.com",
    },
    paymentUrl: "https://checkout.stripe.com/c/pay/cs_test_abc123",
    qrCodeDataUrl: "data:image/png;base64,iVBORw0KGgo=",
    recipientEmail: "ap@acme.com",
    ...overrides,
  };
}

describe("EmailService", () => {
  let service: EmailService;
  let mockResend: ResendClient;
  let mockConfigGet: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockResend = { emails: { send: vi.fn() } };
    mockConfigGet = vi.fn();

    const moduleRef = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: RESEND_CLIENT, useValue: mockResend },
        { provide: ConfigService, useValue: { get: mockConfigGet } },
      ],
    }).compile();

    service = moduleRef.get(EmailService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("sendInvoiceEmail", () => {
    it("sends to the recipient email with a subject identifying the invoice and freelancer", async () => {
      mockConfigGet.mockReturnValue(undefined);
      vi.mocked(mockResend.emails.send).mockResolvedValueOnce({
        data: { id: "resend_id_abc" },
        error: null,
      });

      await service.sendInvoiceEmail(buildParams());

      expect(mockResend.emails.send).toHaveBeenCalledTimes(1);
      const payload = vi.mocked(mockResend.emails.send).mock.calls[0][0];
      expect(payload.to).toBe("ap@acme.com");
      expect(payload.subject).toBe("Invoice INV-2026-0001 from Juan's Studio");
    });

    it("uses RESEND_FROM_EMAIL when configured", async () => {
      mockConfigGet.mockImplementation((key: string) =>
        key === "RESEND_FROM_EMAIL" ? "invoices@raket.app" : undefined,
      );
      vi.mocked(mockResend.emails.send).mockResolvedValueOnce({
        data: { id: "resend_id_abc" },
        error: null,
      });

      await service.sendInvoiceEmail(buildParams());

      const payload = vi.mocked(mockResend.emails.send).mock.calls[0][0];
      expect(payload.from).toBe("invoices@raket.app");
    });

    it("falls back to onboarding@resend.dev when RESEND_FROM_EMAIL is not set", async () => {
      mockConfigGet.mockReturnValue(undefined);
      vi.mocked(mockResend.emails.send).mockResolvedValueOnce({
        data: { id: "resend_id_abc" },
        error: null,
      });

      await service.sendInvoiceEmail(buildParams());

      const payload = vi.mocked(mockResend.emails.send).mock.calls[0][0];
      expect(payload.from).toBe("onboarding@resend.dev");
    });

    it("renders the invoice template into the email html with paymentUrl and a CID QR reference", async () => {
      mockConfigGet.mockReturnValue(undefined);
      vi.mocked(mockResend.emails.send).mockResolvedValueOnce({
        data: { id: "resend_id_abc" },
        error: null,
      });

      await service.sendInvoiceEmail(buildParams());

      const payload = vi.mocked(mockResend.emails.send).mock.calls[0][0];
      expect(payload.html).toContain("https://checkout.stripe.com/c/pay/cs_test_abc123");
      expect(payload.html).toContain('src="cid:qr-invoice"');
      expect(payload.html).not.toContain("data:image/png;base64");
      expect(payload.html).toContain("Landing page design");
      expect(payload.html).toContain("Brand kit");
    });

    it("attaches the QR PNG inline so Gmail (which strips data: URIs) can render it", async () => {
      mockConfigGet.mockReturnValue(undefined);
      vi.mocked(mockResend.emails.send).mockResolvedValueOnce({
        data: { id: "resend_id_abc" },
        error: null,
      });

      await service.sendInvoiceEmail(buildParams());

      const payload = vi.mocked(mockResend.emails.send).mock.calls[0][0];
      expect(payload.attachments).toEqual([
        expect.objectContaining({
          content: "iVBORw0KGgo=",
          content_id: "qr-invoice",
          content_type: "image/png",
          filename: expect.stringMatching(/\.png$/),
        }),
      ]);
    });

    it("omits the QR attachment when qrCodeDataUrl is malformed (still sends the email)", async () => {
      mockConfigGet.mockReturnValue(undefined);
      vi.mocked(mockResend.emails.send).mockResolvedValueOnce({
        data: { id: "resend_id_abc" },
        error: null,
      });

      await service.sendInvoiceEmail(buildParams({ qrCodeDataUrl: "not-a-data-url" }));

      const payload = vi.mocked(mockResend.emails.send).mock.calls[0][0];
      expect(payload.attachments).toBeUndefined();
    });

    it("includes a plain-text fallback alongside the html", async () => {
      mockConfigGet.mockReturnValue(undefined);
      vi.mocked(mockResend.emails.send).mockResolvedValueOnce({
        data: { id: "resend_id_abc" },
        error: null,
      });

      await service.sendInvoiceEmail(buildParams());

      const payload = vi.mocked(mockResend.emails.send).mock.calls[0][0];
      expect(payload.text).toBeDefined();
      expect(payload.text).toContain("https://checkout.stripe.com/c/pay/cs_test_abc123");
    });

    it("returns the resend response id on success", async () => {
      mockConfigGet.mockReturnValue(undefined);
      vi.mocked(mockResend.emails.send).mockResolvedValueOnce({
        data: { id: "resend_id_xyz" },
        error: null,
      });

      const result = await service.sendInvoiceEmail(buildParams());

      expect(result).toEqual({ id: "resend_id_xyz" });
    });

    it("throws when Resend returns an error envelope", async () => {
      mockConfigGet.mockReturnValue(undefined);
      vi.mocked(mockResend.emails.send).mockResolvedValueOnce({
        data: null,
        error: {
          message: "Invalid `to` address",
          name: "validation_error",
          statusCode: 422,
        },
      });

      await expect(service.sendInvoiceEmail(buildParams())).rejects.toThrow();
    });

    it("does not leak the raw Resend error message to the caller", async () => {
      mockConfigGet.mockReturnValue(undefined);
      vi.mocked(mockResend.emails.send).mockResolvedValueOnce({
        data: null,
        error: {
          message: "Invalid `to` address",
          name: "validation_error",
          statusCode: 422,
        },
      });

      await expect(service.sendInvoiceEmail(buildParams())).rejects.not.toThrow(/`to` address/);
    });

    it("converts transport-level errors (fetch throws) into a structured 500", async () => {
      mockConfigGet.mockReturnValue(undefined);
      vi.mocked(mockResend.emails.send).mockRejectedValueOnce(
        new TypeError("fetch failed: ENOTFOUND api.resend.com"),
      );

      await expect(service.sendInvoiceEmail(buildParams())).rejects.toThrow(
        /email service is unavailable/,
      );
    });

    it("logs invoice context when a transport error occurs", async () => {
      mockConfigGet.mockReturnValue(undefined);
      const loggerError = vi.spyOn(Logger.prototype, "error").mockImplementation(() => {});
      vi.mocked(mockResend.emails.send).mockRejectedValueOnce(
        new TypeError("fetch failed: ENOTFOUND api.resend.com"),
      );

      await expect(service.sendInvoiceEmail(buildParams())).rejects.toThrow();

      const message = String(loggerError.mock.calls[0]?.[0] ?? "");
      expect(message).toContain("INV-2026-0001");
      expect(message).toMatch(/transport/i);
    });

    it("renders 'unknown' instead of '(null)' when Resend omits statusCode", async () => {
      mockConfigGet.mockReturnValue(undefined);
      const loggerError = vi.spyOn(Logger.prototype, "error").mockImplementation(() => {});
      vi.mocked(mockResend.emails.send).mockResolvedValueOnce({
        data: null,
        error: {
          message: "Service unavailable",
          name: "internal_server_error",
          statusCode: null,
        },
      });

      await expect(service.sendInvoiceEmail(buildParams())).rejects.toThrow();

      const message = String(loggerError.mock.calls[0]?.[0] ?? "");
      expect(message).toContain("(unknown)");
      expect(message).not.toContain("(null)");
    });
  });
});
