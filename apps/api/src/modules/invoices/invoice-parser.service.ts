import { Injectable } from "@nestjs/common";
import {
  type ParsedInvoiceDraft,
  type ParsedInvoiceLineItem,
  type QuotationMimeType,
  type SupportedCurrency,
  SupportedCurrencySchema,
} from "@raket/contracts";
import { todayIso } from "../../common/utils/dates";
import {
  GeminiService,
  type RawParsedInvoice,
  type RawParsedLineItem,
} from "../integrations/gemini/gemini.service";

@Injectable()
export class InvoiceParserService {
  constructor(private readonly gemini: GeminiService) {}

  async parse(text: string, defaultCurrency?: SupportedCurrency): Promise<ParsedInvoiceDraft> {
    const raw = await this.gemini.parseInvoiceText(text, defaultCurrency);
    return this.sanitize(raw, defaultCurrency);
  }

  async parseFromFile(
    file: Buffer,
    mimeType: QuotationMimeType,
    defaultCurrency?: SupportedCurrency,
  ): Promise<ParsedInvoiceDraft> {
    const raw = await this.gemini.parseInvoiceFromFile(file, mimeType, defaultCurrency);
    return this.sanitize(raw, defaultCurrency);
  }

  private sanitize(
    raw: RawParsedInvoice,
    defaultCurrency: SupportedCurrency | undefined,
  ): ParsedInvoiceDraft {
    const warnings: string[] = [];

    collectTopLevelWarnings(raw, warnings);

    const lineItems: ParsedInvoiceLineItem[] = [];
    for (const item of raw.lineItems) {
      const description = item.description.trim();
      if (description === "") {
        warnings.push("Dropped a line item with no description");
        continue;
      }
      lineItems.push(sanitizeLineItem({ ...item, description }, warnings));
    }

    return {
      clientName: raw.clientName,
      clientEmail: raw.clientEmail,
      currency: resolveCurrency(raw.currency, defaultCurrency),
      issueDate: raw.issueDate ?? todayIso(),
      dueDate: raw.dueDate,
      lineItems,
      warnings,
    };
  }
}

function sanitizeLineItem(raw: RawParsedLineItem, warnings: string[]): ParsedInvoiceLineItem {
  const { description } = raw;

  let quantity = raw.quantity;
  if (quantity === null) {
    warnings.push(`Quantity not found for: ${description}`);
  } else if (quantity <= 0) {
    warnings.push(`Quantity "${quantity}" for "${description}" is not positive — set to null`);
    quantity = null;
  }

  let rate = raw.rate;
  if (rate === null) {
    warnings.push(`Rate not found for: ${description}`);
  } else if (rate < 0) {
    warnings.push(`Rate "${rate}" for "${description}" is negative — set to null`);
    rate = null;
  }

  let amount = raw.amount;
  if (amount !== null && amount < 0) {
    warnings.push(`Amount "${amount}" for "${description}" is negative — set to null`);
    amount = null;
  }

  return {
    description,
    quantity,
    unit: raw.unit,
    rate,
    amount,
  };
}

function collectTopLevelWarnings(raw: RawParsedInvoice, warnings: string[]): void {
  if (raw.clientName === null) {
    warnings.push("Client name could not be extracted");
  }
  if (raw.dueDate === null) {
    warnings.push("Due date could not be determined");
  }
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
