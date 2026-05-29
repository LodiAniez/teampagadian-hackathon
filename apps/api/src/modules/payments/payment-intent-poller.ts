import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../../common/prisma/prisma.service";
import { StripeService } from "../integrations/stripe/stripe.service";
import { PaymentsService } from "./payments.service";

/**
 * Webhook-fallback poller for `payment_intent.succeeded` (TEA-77).
 *
 * Stripe's webhook is the primary settlement signal, but it can be delayed or
 * silently dropped (CLI tunnel down, signature mismatch, transient redelivery
 * failure). Every 10s this poller asks Stripe directly about recently-sent
 * invoices and drives the same `payments.handlePaymentSucceeded` path the
 * webhook does — settlement is idempotent on `stripePaymentIntentId`, so a
 * double-fire from webhook + poll is a no-op.
 *
 * Window is intentionally short (5 min): once an invoice slips past the window
 * without payment, ops can resend the invoice link rather than have the poller
 * grind on stale rows forever.
 *
 * TODO(TEA-77): invoices whose settlement permanently failed stay in `sent`,
 * so this poller keeps retrying them every 10s. Needs a `paymentAttemptedAt`
 * marker or a settlement-failed flag to skip — out of scope for this ticket.
 */
@Injectable()
export class PaymentIntentPoller {
  private static readonly WINDOW_MS = 5 * 60 * 1000;
  private readonly logger = new Logger(PaymentIntentPoller.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly payments: PaymentsService,
  ) {}

  @Cron("*/10 * * * * *")
  async runScheduled(): Promise<void> {
    try {
      await this.pollOnce();
    } catch (err) {
      this.logger.error(
        `path=poll tick failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async pollOnce(): Promise<void> {
    const since = new Date(Date.now() - PaymentIntentPoller.WINDOW_MS);
    const candidates = await this.prisma.invoice.findMany({
      where: {
        status: "sent",
        stripePaymentIntentId: { not: null },
        updatedAt: { gte: since },
      },
      select: { id: true, stripePaymentIntentId: true },
    });

    for (const candidate of candidates) {
      const piId = candidate.stripePaymentIntentId;
      if (!piId) continue;
      try {
        const event = await this.stripe.tryGetPaymentSucceededEvent(piId);
        if (!event) continue;
        this.logger.log(`path=poll invoiceId=${candidate.id} piId=${piId}`);
        await this.payments.handlePaymentSucceeded(event);
      } catch (err) {
        this.logger.error(
          `path=poll invoiceId=${candidate.id} piId=${piId} failed: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
  }
}
