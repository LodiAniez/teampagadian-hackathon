import { Injectable } from "@nestjs/common";
import {
  type ParsedInvoiceDraft,
  type ParsedInvoiceLineItem,
  type SupportedCurrency,
  SupportedCurrencySchema,
} from "@raket/contracts";
import { GeminiService, type RawParsedInvoice } from "../integrations/gemini/gemini.service";

@Injectable()
export class InvoiceParserService {
  constructor(private readonly gemini: GeminiService) {}

  async parse(text: string, defaultCurrency?: SupportedCurrency): Promise<ParsedInvoiceDraft> {
    const raw = await this.gemini.parseInvoiceText(text, defaultCurrency);

    const lineItems = raw.lineItems.map(toLineItem);
    const warnings = collectWarnings(raw);

    return {
      clientName: raw.clientName,
      clientEmail: raw.clientEmail,
      currency: resolveCurrency(raw.currency, defaultCurrency),
      issueDate: raw.issueDate ?? today(),
      dueDate: raw.dueDate,
      lineItems,
      warnings,
    };
  }
}

function toLineItem(raw: RawParsedInvoice["lineItems"][number]): ParsedInvoiceLineItem {
  return {
    description: raw.description,
    quantity: raw.quantity,
    unit: raw.unit,
    rate: raw.rate,
    amount: raw.amount,
  };
}

function resolveCurrency(
  raw: string | null,
  fallback: SupportedCurrency | undefined,
): SupportedCurrency {
  const parsed = SupportedCurrencySchema.safeParse(raw);
  if (parsed.success) {
    return parsed.data;
  }
  return fallback ?? "USD";
}

function collectWarnings(raw: RawParsedInvoice): string[] {
  const warnings: string[] = [];

  if (raw.clientName === null) {
    warnings.push("Client name could not be extracted");
  }
  if (raw.dueDate === null) {
    warnings.push("Due date could not be determined");
  }
  for (const item of raw.lineItems) {
    if (item.quantity === null) {
      warnings.push(`Quantity not found for: ${item.description}`);
    }
    if (item.rate === null) {
      warnings.push(`Rate not found for: ${item.description}`);
    }
  }

  return warnings;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
