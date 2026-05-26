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
