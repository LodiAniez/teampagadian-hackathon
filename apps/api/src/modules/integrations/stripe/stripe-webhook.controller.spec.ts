import { BadRequestException } from "@nestjs/common";
import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import { PaymentsService } from "../../payments/payments.service";
import { StripeWebhookController } from "./stripe-webhook.controller";
import { StripeService } from "./stripe.service";
import type { WebhookEvent } from "./stripe.types";

const rawBody = Buffer.from("raw-body-payload");

const sampleEvent = (type: string, object: unknown): WebhookEvent => ({
  id: "evt_test_123",
  type,
  data: { object },
});

describe("StripeWebhookController", () => {
  let controller: StripeWebhookController;
  let stripeService: DeepMockProxy<StripeService>;
  let paymentsService: DeepMockProxy<PaymentsService>;

  beforeEach(() => {
    stripeService = mockDeep<StripeService>();
    paymentsService = mockDeep<PaymentsService>();
    controller = new StripeWebhookController(stripeService, paymentsService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("dispatches payment_intent.succeeded to PaymentsService with the mapped domain event", async () => {
    const pi = {
      id: "pi_test_123",
      amount_received: 10000,
      currency: "usd",
      latest_charge: "ch_test_123",
      created: 1716000000,
      metadata: { invoice_id: "inv_abc" },
    };
    stripeService.constructEvent.mockReturnValueOnce(sampleEvent("payment_intent.succeeded", pi));

    const result = await controller.handle({ rawBody }, "sig-header");

    expect(stripeService.constructEvent).toHaveBeenCalledWith(rawBody, "sig-header");
    expect(paymentsService.handlePaymentSucceeded).toHaveBeenCalledWith({
      stripePaymentIntentId: "pi_test_123",
      stripeChargeId: "ch_test_123",
      amountReceived: 100,
      amountReceivedCurrency: "USD",
      invoiceId: "inv_abc",
      paidAt: new Date(1716000000 * 1000),
    });
    expect(result).toEqual({ received: true });
  });

  it("dispatches checkout.session.completed to PaymentsService with the mapped domain event", async () => {
    const session = {
      id: "cs_test_123",
      payment_intent: "pi_test_456",
      metadata: { invoice_id: "inv_xyz" },
    };
    stripeService.constructEvent.mockReturnValueOnce(
      sampleEvent("checkout.session.completed", session),
    );

    const result = await controller.handle({ rawBody }, "sig-header");

    expect(paymentsService.handleCheckoutCompleted).toHaveBeenCalledWith({
      stripeSessionId: "cs_test_123",
      stripePaymentIntentId: "pi_test_456",
      invoiceId: "inv_xyz",
    });
    expect(result).toEqual({ received: true });
  });

  it("returns received:true for unhandled event types without calling PaymentsService", async () => {
    stripeService.constructEvent.mockReturnValueOnce(
      sampleEvent("customer.created", { id: "cus_123" }),
    );

    const result = await controller.handle({ rawBody }, "sig-header");

    expect(paymentsService.handlePaymentSucceeded).not.toHaveBeenCalled();
    expect(paymentsService.handleCheckoutCompleted).not.toHaveBeenCalled();
    expect(result).toEqual({ received: true });
  });

  it("rejects with BadRequestException when signature verification fails", async () => {
    const sigError = new Stripe.errors.StripeSignatureVerificationError("header", "payload", {
      message: "Signature mismatch",
    });
    stripeService.constructEvent.mockImplementationOnce(() => {
      throw sigError;
    });

    await expect(controller.handle({ rawBody }, "bad-sig")).rejects.toThrow(BadRequestException);
  });

  it("bubbles non-signature errors (e.g. missing webhook secret) unchanged", async () => {
    const internalError = new Error("STRIPE_WEBHOOK_SECRET not configured");
    stripeService.constructEvent.mockImplementationOnce(() => {
      throw internalError;
    });

    await expect(controller.handle({ rawBody }, "sig-header")).rejects.toBe(internalError);
  });

  it("rejects with BadRequestException when raw body is missing", async () => {
    await expect(controller.handle({}, "sig-header")).rejects.toThrow(BadRequestException);
    expect(stripeService.constructEvent).not.toHaveBeenCalled();
  });
});
