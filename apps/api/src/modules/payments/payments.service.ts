import { Injectable, Logger } from "@nestjs/common";
import type { CheckoutCompletedEvent, PaymentSucceededEvent } from "./payments.types";

/**
 * Stub for TEA-40. The webhook controller dispatches here after signature
 * verification + domain-shape mapping. Real implementation lands in TEA-42
 * (FX computation + payment-row creation via SettlementService).
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  async handlePaymentSucceeded(event: PaymentSucceededEvent): Promise<void> {
    this.logger.log(
      `[stub] payment_intent.succeeded for invoice ${event.invoiceId} (PI ${event.stripePaymentIntentId}, ${event.amountReceived} ${event.amountReceivedCurrency})`,
    );
  }

  async handleCheckoutCompleted(event: CheckoutCompletedEvent): Promise<void> {
    this.logger.log(
      `[stub] checkout.session.completed for invoice ${event.invoiceId} (session ${event.stripeSessionId})`,
    );
  }
}
