import { Inject, Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { EnvConfig } from "@/common/config/env.schema";
import {
  RESEND_CLIENT,
  type ResendClient,
  type SendInvoiceEmailParams,
  type SendInvoiceEmailResult,
} from "./email.types";
import { renderInvoiceEmail, renderInvoiceEmailText } from "./templates/invoice-email";

const DEFAULT_FROM = "onboarding@resend.dev";

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    @Inject(RESEND_CLIENT) private readonly resend: ResendClient,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  /**
   * Sends the invoice email a client receives: greeting, "Pay Now" → Stripe
   * Checkout, inline QR, line-item summary, freelancer signature.
   *
   * Consumed by: TEA-37 (Send invoice endpoint). Caller maps Prisma rows into
   * the narrow {@link SendInvoiceEmailParams} shape and provides the Stripe
   * Checkout URL + QR data URL (TEA-34, TEA-35).
   */
  async sendInvoiceEmail(params: SendInvoiceEmailParams): Promise<SendInvoiceEmailResult> {
    const renderParams = {
      invoice: params.invoice,
      freelancer: params.freelancer,
      paymentUrl: params.paymentUrl,
      qrCodeDataUrl: params.qrCodeDataUrl,
    };

    const response = await this.resend.emails.send({
      from: this.config.get("RESEND_FROM_EMAIL", { infer: true }) ?? DEFAULT_FROM,
      to: params.recipientEmail,
      subject: `Invoice ${params.invoice.number} from ${params.freelancer.displayName}`,
      html: renderInvoiceEmail(renderParams),
      text: renderInvoiceEmailText(renderParams),
    });

    if (response.error) {
      this.logger.error(
        `Resend rejected invoice ${params.invoice.number}: ${response.error.name} (${response.error.statusCode}) ${response.error.message}`,
      );
      throw new InternalServerErrorException(
        "Failed to send invoice email — the email service is unavailable. Please try again.",
      );
    }

    this.logger.log(
      `Sent invoice ${params.invoice.number} to ${params.recipientEmail} (resend id=${response.data.id})`,
    );
    return { id: response.data.id };
  }
}
