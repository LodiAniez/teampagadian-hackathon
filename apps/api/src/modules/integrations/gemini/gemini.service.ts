import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiError, GoogleGenAI, Type, type GenerateContentResponse } from "@google/genai";
import { z } from "zod";
import type { EnvConfig } from "../../../common/config/env.schema";

// Upstream statuses worth one retry: gateway/availability blips. Quota (429)
// and other 4xx won't recover from an immediate retry, so we fail fast on those.
const RETRYABLE_STATUSES = new Set([502, 503, 504]);

function buildSystemInstruction(defaultCurrency?: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const currencyLine = defaultCurrency
    ? `If no currency is stated, assume ${defaultCurrency}.`
    : "If no currency is stated, leave currency null.";

  return [
    "You extract structured invoice data from a freelancer's plain-text description of work.",
    `Today's date is ${today}.`,
    'Resolve relative dates against today and output them as YYYY-MM-DD — e.g. "due in 30 days", "net 15", "by next Friday". If a date truly cannot be determined, use null.',
    "Set any field to null when the text does not provide it — never guess amounts, dates, or client names.",
    currencyLine,
    "Treat each distinct piece of work as its own line item with a concise description.",
    'Parse amounts and rates from natural phrasing: "$1,500" → 1500; "$90/hour for 10 hours" → rate 90, quantity 10, unit "hour".',
    "Compute lineItems[].amount only when both quantity and rate are present; otherwise null. A flat fee sets amount with quantity and rate null.",
  ].join(" ");
}

// Gemini structured-output schema for `responseSchema`. Optional fields are
// marked `nullable` and listed in `required` so the model emits them as null
// rather than omitting the key.
const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    clientName: { type: Type.STRING, nullable: true },
    clientEmail: { type: Type.STRING, nullable: true },
    currency: { type: Type.STRING, nullable: true },
    issueDate: { type: Type.STRING, nullable: true },
    dueDate: { type: Type.STRING, nullable: true },
    lineItems: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING },
          quantity: { type: Type.NUMBER, nullable: true },
          unit: { type: Type.STRING, nullable: true },
          rate: { type: Type.NUMBER, nullable: true },
          amount: { type: Type.NUMBER, nullable: true },
        },
        required: ["description", "quantity", "unit", "rate", "amount"],
      },
    },
  },
  required: ["clientName", "clientEmail", "currency", "issueDate", "dueDate", "lineItems"],
};

// Loose decode of raw model output. Intentionally drops the contract's
// min/max/email/positive constraints so the parser can normalize and repair
// (e.g. null currency → fallback) instead of rejecting. Do not tighten this to
// match ParsedInvoiceDraftSchema — that coupling is what we're avoiding.
const RawParsedInvoiceSchema = z.object({
  clientName: z.string().nullable(),
  clientEmail: z.string().nullable(),
  currency: z.string().nullable(),
  issueDate: z.string().nullable(),
  dueDate: z.string().nullable(),
  lineItems: z.array(
    z.object({
      description: z.string(),
      quantity: z.number().nullable(),
      unit: z.string().nullable(),
      rate: z.number().nullable(),
      amount: z.number().nullable(),
    }),
  ),
});

export type RawParsedInvoice = z.infer<typeof RawParsedInvoiceSchema>;
export type RawParsedLineItem = RawParsedInvoice["lineItems"][number];

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly client: GoogleGenAI;
  private readonly model: string;

  constructor(config: ConfigService<EnvConfig, true>) {
    this.client = new GoogleGenAI({ apiKey: config.get("GEMINI_API_KEY", { infer: true }) });
    this.model = config.get("GEMINI_MODEL", { infer: true });
  }

  async parseInvoiceText(text: string, defaultCurrency?: string): Promise<RawParsedInvoice> {
    const response = await this.generate(text, buildSystemInstruction(defaultCurrency));
    return this.parseResponse(response.text);
  }

  // Failures are logged server-side and surfaced as a generic 500 so the raw
  // upstream error is never leaked to the client.
  private async generate(
    text: string,
    systemInstruction: string,
  ): Promise<GenerateContentResponse> {
    const call = () =>
      this.client.models.generateContent({
        model: this.model,
        contents: text,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0,
        },
      });

    try {
      return await call();
    } catch (err) {
      const retryable = !(err instanceof ApiError) || RETRYABLE_STATUSES.has(err.status);
      if (!retryable) throw this.fail(err);
      this.logger.warn(`Gemini transient error, retrying once: ${describeError(err)}`);
      try {
        return await call();
      } catch (retryErr) {
        throw this.fail(retryErr);
      }
    }
  }

  private fail(err: unknown): InternalServerErrorException {
    this.logger.error(`Gemini request failed: ${describeError(err)}`);
    return new InternalServerErrorException(
      "Failed to parse invoice text — the AI service is unavailable. Please try again.",
    );
  }

  private parseResponse(content: string | undefined): RawParsedInvoice {
    if (!content) {
      throw new InternalServerErrorException("Gemini returned an empty response");
    }

    let json: unknown;
    try {
      json = JSON.parse(content);
    } catch {
      throw new InternalServerErrorException("Gemini returned malformed JSON");
    }

    const result = RawParsedInvoiceSchema.safeParse(json);
    if (!result.success) {
      throw new InternalServerErrorException("Gemini response did not match the invoice schema");
    }
    return result.data;
  }
}

function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    return `status=${err.status} ${err.message}`;
  }
  return err instanceof Error ? err.message : String(err);
}
