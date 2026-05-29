import { Injectable, Logger } from "@nestjs/common";
import { FxRateService } from "../integrations/fx/fx-rate.service";
import { PayoutsService } from "../payouts/payouts.service";
import { SettlementService } from "../settlement/settlement.service";
import { SettlementFailedError } from "../settlement/settlement.types";
import type { CheckoutCompletedEvent, PaymentSucceededEvent } from "./payments.types";

const FX_FEE_PERCENT = 0.01;

const round2 = (n: number): number => Math.round(n * 100) / 100;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly fxRateService: FxRateService,
    private readonly settlementService: SettlementService,
    private readonly payoutsService: PayoutsService,
  ) {}

  async handlePaymentSucceeded(event: PaymentSucceededEvent): Promise<void> {
    const fxRate = await this.fxRateService.getRate(event.amountReceivedCurrency, "PHP");
    const grossPhp = event.amountReceived * fxRate;
    const fxFeeAmount = round2(grossPhp * FX_FEE_PERCENT);
    const amountPhp = round2(grossPhp - fxFeeAmount);

    let payment;
    try {
      payment = await this.settlementService.settle({
        paymentIntentId: event.stripePaymentIntentId,
        stripeChargeId: event.stripeChargeId,
        invoiceId: event.invoiceId,
        amountReceived: event.amountReceived,
        amountReceivedCurrency: event.amountReceivedCurrency,
        fxRate,
        fxFeeAmount,
        fxFeePercent: FX_FEE_PERCENT,
        amountPhp,
        paidAt: event.paidAt,
      });
    } catch (err) {
      // Permanent FAILED row — swallow so Stripe stops redelivering against
      // a row that will throw forever. See TEA-42 plan, "webhook redelivery
      // on SettlementFailedError".
      if (err instanceof SettlementFailedError) {
        this.logger.error(
          `Settlement permanently failed for PI ${event.stripePaymentIntentId} (payment ${err.paymentId}); manual recovery required`,
        );
        return;
      }
      throw err;
    }

    if (payment.morphTxStatus === "SETTLED") {
      await this.payoutsService.disburseToFreelancer(payment.id);
    }
  }

  async handleCheckoutCompleted(event: CheckoutCompletedEvent): Promise<void> {
    this.logger.log(
      `checkout.session.completed for invoice ${event.invoiceId} (session ${event.stripeSessionId}) — no-op`,
    );
  }
}
