import {
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnprocessableEntityException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { CardDetails } from "@raket/contracts";
import type { EnvConfig } from "@/common/config/env.schema";
import type { PaymentSucceededEvent } from "../../payments/payments.types";
import { toPaymentSucceededEvent } from "./stripe-event-mappers";
import {
  STRIPE_CLIENT,
  type CheckoutSessionResult,
  type SetupIntentResult,
  type StripeClient,
  type WebhookEvent,
} from "./stripe.types";

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);

  constructor(
    @Inject(STRIPE_CLIENT) private readonly stripe: StripeClient,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  /**
   * Creates a Stripe SetupIntent for tokenizing a card as a non-GCash payout
   * fallback. Primary payout path remains GCash via Coins.ph (mocked for
   * hackathon); this is the fallback for freelancers without GCash, who'd
   * later receive payouts via Stripe push to the tokenized card.
   *
   * Consumed by: POST /api/payout-methods/setup-intent (TEA-23).
   */
  async createSetupIntent(userId: string): Promise<SetupIntentResult> {
    const intent = await this.stripe.setupIntents.create({
      payment_method_types: ["card"],
      usage: "off_session",
      metadata: { userId },
    });

    if (!intent.client_secret) {
      throw new InternalServerErrorException(
        `Stripe SetupIntent ${intent.id} returned no client_secret`,
      );
    }

    this.logger.log(`Created SetupIntent ${intent.id} for user ${userId}`);
    return { setupIntentId: intent.id, clientSecret: intent.client_secret };
  }

  // LIMITATION: rejects PMs attached to a Stripe Customer, but cannot verify
  // cross-user ownership within this app — all our SetupIntents create
  // unattached PMs (customer: null). Full fix requires a stripeCustomerId
  // on User and passing customer to SetupIntent.create.
  async retrieveCardDetails(stripePaymentMethodId: string): Promise<CardDetails> {
    const pm = await this.stripe.paymentMethods.retrieve(stripePaymentMethodId);
    if (pm.customer) {
      throw new ForbiddenException("Payment method belongs to another Stripe customer");
    }
    if (pm.type !== "card" || !pm.card) {
      throw new UnprocessableEntityException("Payment method is not a card");
    }
    return {
      brand: pm.card.brand,
      last4: pm.card.last4,
      expMonth: pm.card.exp_month,
      expYear: pm.card.exp_year,
      stripePaymentMethodId: pm.id,
    };
  }

  /**
   * Creates a Stripe Checkout Session for invoice payment.
   *
   * Uses a single line item for the invoice total so fractional quantities
   * (e.g. 20.5 hours) don't hit Stripe's integer-quantity constraint.
   * The payment intent ID is not captured here — it arrives via the
   * checkout.session.completed webhook (TEA-40) once the client pays.
   */
  async createInvoiceCheckoutSession(
    invoice: { id: string; number: string; amount: number; currency: string },
    clientEmail: string,
    successUrl: string,
  ): Promise<CheckoutSessionResult> {
    // Keyed on invoiceId so a retry after a transient failure (DB blip between
    // session creation and the final invoice.update) returns the same Stripe
    // session instead of orphaning the first one — Stripe stores the key for
    // ~24h, which covers any realistic retry window.
    const session = await this.stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer_email: clientEmail,
        line_items: [
          {
            price_data: {
              currency: invoice.currency.toLowerCase(),
              product_data: { name: `Invoice ${invoice.number}` },
              unit_amount: Math.round(invoice.amount * 100),
            },
            quantity: 1,
          },
        ],
        success_url: successUrl,
        metadata: { invoiceId: invoice.id },
      },
      { idempotencyKey: `send-invoice-${invoice.id}` },
    );

    if (!session.url) {
      throw new InternalServerErrorException(
        `Stripe Checkout session ${session.id} returned no URL`,
      );
    }

    this.logger.log(`Created Checkout session ${session.id} for invoice ${invoice.id}`);
    return { id: session.id, url: session.url };
  }

  /**
   * Verifies a Stripe webhook payload's signature and returns a narrow event
   * envelope ({ id, type, data: { object: unknown } }). The webhook controller
   * (TEA-40, same slice) Zod-validates `data.object` per event type before
   * passing a domain shape to other slices — per docs/api-convention.md §8.
   *
   * Throws InternalServerError if STRIPE_WEBHOOK_SECRET is missing. Stripe's
   * own signature-verification error propagates as-is; the webhook controller
   * should catch it and return 400.
   */
  constructEvent(rawBody: Buffer | string, signature: string): WebhookEvent {
    const secret = this.config.get("STRIPE_WEBHOOK_SECRET", { infer: true });
    if (!secret) {
      throw new InternalServerErrorException(
        "STRIPE_WEBHOOK_SECRET not configured — set in Railway after the webhook endpoint is registered",
      );
    }
    return this.stripe.webhooks.constructEvent(rawBody, signature, secret);
  }

  /**
   * Retrieves a PaymentIntent and, if its status is `succeeded`, returns the
   * domain `PaymentSucceededEvent` the payments slice consumes. Returns null
   * for any non-succeeded status so callers can no-op without branching on
   * Stripe-specific values.
   *
   * Stripe SDK types do not cross this slice boundary — the same Zod mapper
   * the webhook controller uses (`toPaymentSucceededEvent`) parses `data.object`
   * here, keeping the trust boundary discipline (docs/api-convention.md §8).
   *
   * Consumed by: PaymentIntentPoller (TEA-77) as a webhook fallback.
   */
  async tryGetPaymentSucceededEvent(piId: string): Promise<PaymentSucceededEvent | null> {
    const pi = await this.stripe.paymentIntents.retrieve(piId);
    if (pi.status !== "succeeded") return null;
    // Stripe's PaymentIntent.latest_charge is `string | Charge | null`; without
    // `expand` we always get the string form, but normalize defensively so an
    // accidental expand later can't slip an object past the Zod mapper.
    const latestCharge =
      pi.latest_charge && typeof pi.latest_charge === "object"
        ? pi.latest_charge.id
        : pi.latest_charge;
    return toPaymentSucceededEvent({ ...pi, latest_charge: latestCharge });
  }
}
