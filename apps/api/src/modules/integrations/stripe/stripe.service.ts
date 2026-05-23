import { Inject, Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { EnvConfig } from "@/common/config/env.schema";
import {
  STRIPE_CLIENT,
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
}
