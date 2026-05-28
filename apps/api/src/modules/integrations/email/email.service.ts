import { Inject, Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { EnvConfig } from "@/common/config/env.schema";
import {
  RESEND_CLIENT,
  type ResendClient,
  type SendInvoiceEmailParams,
  type SendInvoiceEmailResult,
} from "./email.types";
import {
  QR_CONTENT_ID,
  renderInvoiceEmail,
  renderInvoiceEmailText,
} from "./templates/invoice-email";

// Splits `data:image/png;base64,XXXX...` → { contentType, content }. Returns
// null if the value isn't a recognisable PNG data URI; caller falls back to
// sending without the inline attachment rather than crashing the send.
function parsePngDataUrl(dataUrl: string): { contentType: string; content: string } | null {
  const match = /^data:(image\/png);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  return { contentType: match[1], content: match[2] };
}

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
    };

    // CID inline attachment. Gmail strips base64 `data:` URIs in `<img src>`,
    // so the template references `cid:qr-invoice` and we attach the PNG bytes
    // here. If the data URL is malformed we send without the QR rather than
    // failing the email — the payment URL is the primary call-to-action.
    const qr = parsePngDataUrl(params.qrCodeDataUrl);
    const attachments = qr
      ? [
          {
            content: qr.content,
            filename: "invoice-qr.png",
            contentId: QR_CONTENT_ID,
            contentType: qr.contentType,
          },
        ]
      : undefined;

    // resend.emails.send() resolves to a { data, error } envelope for HTTP-level
    // failures, but the underlying fetch throws on transport faults (DNS,
    // timeout, TLS). Wrap the call so both paths produce the same structured
    // 500 with invoice context in logs — otherwise transport errors propagate
    // raw and the caller sees a generic Nest filter response with no audit trail.
    let response;
    try {
      response = await this.resend.emails.send({
        from: this.config.get("RESEND_FROM_EMAIL", { infer: true }) ?? DEFAULT_FROM,
        to: params.recipientEmail,
        subject: `Invoice ${params.invoice.number} from ${params.freelancer.displayName}`,
        html: renderInvoiceEmail(renderParams),
        text: renderInvoiceEmailText(renderParams),
        attachments,
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.error(`Resend transport error for invoice ${params.invoice.number}: ${reason}`);
      throw new InternalServerErrorException(
        "Failed to send invoice email — the email service is unavailable. Please try again.",
      );
    }

    if (response.error) {
      this.logger.error(
        `Resend rejected invoice ${params.invoice.number}: ${response.error.name} (${response.error.statusCode ?? "unknown"}) ${response.error.message}`,
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
