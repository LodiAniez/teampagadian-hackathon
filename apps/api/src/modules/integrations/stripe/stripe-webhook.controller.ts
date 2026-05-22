import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Req,
} from "@nestjs/common";
import Stripe from "stripe";
import { PaymentsService } from "../../payments/payments.service";
import { toCheckoutCompletedEvent, toPaymentSucceededEvent } from "./stripe-event-mappers";
import { StripeService } from "./stripe.service";

interface RawBodyContext {
  rawBody?: Buffer | string;
}

/**
 * Stripe webhook handler. Special integration controller per
 * docs/api-convention.md §8 — no AuthGuard (Stripe signature is the auth),
 * raw body required for signature verification, returns 200 fast and
 * delegates business logic to PaymentsService.
 */
@Controller("webhooks/stripe")
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(
    private readonly stripe: StripeService,
    private readonly payments: PaymentsService,
  ) {}

  @Post()
  @HttpCode(200)
  async handle(
    @Req() req: RawBodyContext,
    @Headers("stripe-signature") signature: string,
  ): Promise<{ received: true }> {
    if (!req.rawBody) {
      throw new BadRequestException("Missing raw body");
    }

    let event;
    try {
      event = this.stripe.constructEvent(req.rawBody, signature);
    } catch (err) {
      if (err instanceof Stripe.errors.StripeSignatureVerificationError) {
        throw new BadRequestException("Invalid signature");
      }
      throw err;
    }

    this.logger.log(`Received ${event.type} (event id ${event.id})`);

    switch (event.type) {
      case "payment_intent.succeeded":
        await this.payments.handlePaymentSucceeded(toPaymentSucceededEvent(event.data.object));
        break;
      case "checkout.session.completed":
        await this.payments.handleCheckoutCompleted(toCheckoutCompletedEvent(event.data.object));
        break;
      default:
        this.logger.log(`No handler for ${event.type}; ignoring`);
    }

    return { received: true };
  }
}
