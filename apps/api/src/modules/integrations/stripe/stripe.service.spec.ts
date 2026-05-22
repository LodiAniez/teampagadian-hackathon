import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import type Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StripeService } from "./stripe.service";
import { STRIPE_CLIENT, type StripeClient } from "./stripe.types";

describe("StripeService", () => {
  let service: StripeService;
  let mockStripe: StripeClient;
  let mockConfigGet: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockStripe = {
      setupIntents: { create: vi.fn() },
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

  describe("constructEvent", () => {
    it("verifies the webhook signature against the configured secret", () => {
      mockConfigGet.mockReturnValue("whsec_test_secret");
      const fakeEvent: Pick<Stripe.Event, "id" | "type"> = {
        id: "evt_1",
        type: "payment_intent.succeeded",
      };
      vi.mocked(mockStripe.webhooks.constructEvent).mockReturnValueOnce(fakeEvent as Stripe.Event);

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
