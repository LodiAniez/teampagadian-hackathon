import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StripeService } from "./stripe.service";
import { STRIPE_CLIENT, type StripeClient, type WebhookEvent } from "./stripe.types";

describe("StripeService", () => {
  let service: StripeService;
  let mockStripe: StripeClient;
  let mockConfigGet: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockStripe = {
      setupIntents: { create: vi.fn() },
      paymentMethods: { retrieve: vi.fn() },
      checkout: { sessions: { create: vi.fn() } },
      paymentIntents: { retrieve: vi.fn() },
      webhooks: { constructEvent: vi.fn() },
    };
    mockConfigGet = vi.fn();

    const moduleRef = await Test.createTestingModule({
      providers: [
        StripeService,
        { provide: STRIPE_CLIENT, useValue: mockStripe },
        { provide: ConfigService, useValue: { get: mockConfigGet } },
      ],
    }).compile();

    service = moduleRef.get(StripeService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("createSetupIntent", () => {
    it("tags the SetupIntent with the user's id for later attribution", async () => {
      vi.mocked(mockStripe.setupIntents.create).mockResolvedValueOnce({
        id: "seti_test_123",
        client_secret: "seti_test_123_secret_xyz",
      });

      await service.createSetupIntent("user-abc");

      expect(mockStripe.setupIntents.create).toHaveBeenCalledWith({
        payment_method_types: ["card"],
        usage: "off_session",
        metadata: { userId: "user-abc" },
      });
    });

    it("returns the setupIntentId and clientSecret from Stripe's response", async () => {
      vi.mocked(mockStripe.setupIntents.create).mockResolvedValueOnce({
        id: "seti_test_123",
        client_secret: "seti_test_123_secret_xyz",
      });

      const result = await service.createSetupIntent("user-abc");

      expect(result).toEqual({
        setupIntentId: "seti_test_123",
        clientSecret: "seti_test_123_secret_xyz",
      });
    });

    it("rejects when Stripe returns a SetupIntent without a client_secret", async () => {
      vi.mocked(mockStripe.setupIntents.create).mockResolvedValueOnce({
        id: "seti_test_123",
        client_secret: null,
      });

      await expect(service.createSetupIntent("user-abc")).rejects.toThrow(/no client_secret/);
    });
  });

  describe("retrieveCardDetails", () => {
    it("returns card details for an unattached payment method", async () => {
      vi.mocked(mockStripe.paymentMethods.retrieve).mockResolvedValueOnce({
        id: "pm_test",
        type: "card",
        customer: null,
        card: { brand: "visa", last4: "4242", exp_month: 12, exp_year: 2030 },
      });

      const result = await service.retrieveCardDetails("pm_test");

      expect(result).toEqual({
        brand: "visa",
        last4: "4242",
        expMonth: 12,
        expYear: 2030,
        stripePaymentMethodId: "pm_test",
      });
    });

    it("rejects when the payment method belongs to a Stripe customer", async () => {
      vi.mocked(mockStripe.paymentMethods.retrieve).mockResolvedValueOnce({
        id: "pm_test",
        type: "card",
        customer: "cus_other",
        card: { brand: "visa", last4: "4242", exp_month: 12, exp_year: 2030 },
      });

      await expect(service.retrieveCardDetails("pm_test")).rejects.toThrow(
        /belongs to another Stripe customer/,
      );
    });

    it("rejects when the payment method is not a card", async () => {
      vi.mocked(mockStripe.paymentMethods.retrieve).mockResolvedValueOnce({
        id: "pm_test",
        type: "us_bank_account",
        customer: null,
        card: null,
      });

      await expect(service.retrieveCardDetails("pm_test")).rejects.toThrow(/not a card/);
    });
  });

  describe("createInvoiceCheckoutSession", () => {
    const invoice = { id: "inv_123", number: "INV-2026-0001", amount: 100.5, currency: "PHP" };

    it("passes an invoice-scoped idempotency key so retries return the same session", async () => {
      vi.mocked(mockStripe.checkout.sessions.create).mockResolvedValueOnce({
        id: "cs_test",
        url: "https://checkout.stripe.com/cs_test",
      });

      await service.createInvoiceCheckoutSession(invoice, "client@example.com", "https://app/ok");

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: { invoiceId: "inv_123" } }),
        { idempotencyKey: "send-invoice-inv_123" },
      );
    });

    it("rejects when Stripe returns a session without a URL", async () => {
      vi.mocked(mockStripe.checkout.sessions.create).mockResolvedValueOnce({
        id: "cs_test",
        url: null,
      });

      await expect(
        service.createInvoiceCheckoutSession(invoice, "client@example.com", "https://app/ok"),
      ).rejects.toThrow(/returned no URL/);
    });
  });

  describe("tryGetPaymentSucceededEvent", () => {
    it("returns a mapped PaymentSucceededEvent when the PI status is succeeded", async () => {
      vi.mocked(mockStripe.paymentIntents.retrieve).mockResolvedValueOnce({
        id: "pi_test_succeeded",
        status: "succeeded",
        amount_received: 10000,
        currency: "usd",
        latest_charge: "ch_test_456",
        created: 1748476800,
        metadata: { invoice_id: "invoice-1" },
      });

      const result = await service.tryGetPaymentSucceededEvent("pi_test_succeeded");

      expect(mockStripe.paymentIntents.retrieve).toHaveBeenCalledWith("pi_test_succeeded");
      expect(result).toEqual({
        stripePaymentIntentId: "pi_test_succeeded",
        stripeChargeId: "ch_test_456",
        amountReceived: 100,
        amountReceivedCurrency: "USD",
        invoiceId: "invoice-1",
        paidAt: new Date(1748476800 * 1000),
      });
    });

    it("returns null and does not map when the PI status is not succeeded", async () => {
      vi.mocked(mockStripe.paymentIntents.retrieve).mockResolvedValueOnce({
        id: "pi_test_pending",
        status: "requires_payment_method",
        amount_received: 0,
        currency: "usd",
        latest_charge: null,
        created: 1748476800,
        metadata: { invoice_id: "invoice-1" },
      });

      const result = await service.tryGetPaymentSucceededEvent("pi_test_pending");

      expect(result).toBeNull();
    });
  });

  describe("constructEvent", () => {
    it("verifies the webhook signature against the configured secret", () => {
      mockConfigGet.mockReturnValue("whsec_test_secret");
      const fakeEvent: WebhookEvent = {
        id: "evt_1",
        type: "payment_intent.succeeded",
        data: { object: { foo: "bar" } },
      };
      vi.mocked(mockStripe.webhooks.constructEvent).mockReturnValueOnce(fakeEvent);

      const result = service.constructEvent("raw-body", "sig-header");

      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(
        "raw-body",
        "sig-header",
        "whsec_test_secret",
      );
      expect(result).toBe(fakeEvent);
    });

    it("rejects when STRIPE_WEBHOOK_SECRET is not configured", () => {
      mockConfigGet.mockReturnValue(undefined);

      expect(() => service.constructEvent("raw-body", "sig-header")).toThrow(
        /STRIPE_WEBHOOK_SECRET not configured/,
      );
    });
  });
});
