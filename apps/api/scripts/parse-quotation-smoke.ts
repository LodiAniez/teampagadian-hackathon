/**
 * TEA-30 quotation parsing smoke test — runs ONE real Gemini vision call
 * against a local PDF or image file through the full InvoiceParserService
 * pipeline. Use this to verify end-to-end that vision parsing produces
 * sensible drafts on the sample quotations you plan to demo with.
 *
 * Unlike the unit tests (which mock the SDK), this calls the live Gemini
 * API and consumes free-tier quota. Not run in CI.
 *
 * Run:
 *   npx tsx apps/api/scripts/parse-quotation-smoke.ts ./path/to/quotation.pdf
 *   npx tsx apps/api/scripts/parse-quotation-smoke.ts ./path/to/quotation.png PHP
 *
 * Args:
 *   <file>             Path to PDF / PNG / JPEG (required)
 *   [defaultCurrency]  Optional ISO 4217 code used when the model can't
 *                      detect a currency (e.g. USD, PHP, EUR)
 *
 * Output: pretty-printed ParsedInvoiceDraft + warnings. Exit 0 on a
 * parseable response, non-zero on any failure.
 */
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { extname } from "node:path";
import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import {
  QUOTATION_MAX_BYTES,
  QUOTATION_MIME_TYPES,
  type QuotationMimeType,
  SupportedCurrencySchema,
} from "@raket/contracts";
import { AppModule } from "../src/app.module";
import { InvoiceParserService } from "../src/modules/invoices/invoice-parser.service";

const TAG = "parse-quotation-smoke";

const EXT_TO_MIME: Record<string, QuotationMimeType> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

async function main(): Promise<void> {
  const [filePath, defaultCurrencyArg] = process.argv.slice(2);
  if (!filePath) {
    console.error("Usage: tsx apps/api/scripts/parse-quotation-smoke.ts <file> [defaultCurrency]");
    process.exit(1);
  }

  const abs = path.resolve(filePath);
  const stats = await stat(abs).catch(() => null);
  if (!stats || !stats.isFile()) {
    console.error(`File not found or not a regular file: ${abs}`);
    process.exit(1);
  }
  if (stats.size > QUOTATION_MAX_BYTES) {
    console.error(
      `File too large (${stats.size} bytes). Limit is ${QUOTATION_MAX_BYTES} bytes (5 MB).`,
    );
    process.exit(1);
  }

  const mimeType = EXT_TO_MIME[extname(abs).toLowerCase()];
  if (!mimeType) {
    console.error(
      `Unsupported file extension. Allowed: .pdf, .png, .jpg, .jpeg. Got: ${extname(abs)}`,
    );
    process.exit(1);
  }
  if (!(QUOTATION_MIME_TYPES as readonly string[]).includes(mimeType)) {
    console.error(`Unexpected MIME mapping: ${mimeType}`);
    process.exit(1);
  }

  const defaultCurrency = defaultCurrencyArg
    ? SupportedCurrencySchema.parse(defaultCurrencyArg)
    : undefined;

  const logger = new Logger(TAG);
  logger.log(`Loading ${abs} (${stats.size} bytes, ${mimeType})`);
  const buffer = await readFile(abs);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });

  try {
    const parser = app.get(InvoiceParserService);

    const before = Date.now();
    const draft = await parser.parseFromFile(buffer, mimeType, defaultCurrency);
    const elapsedMs = Date.now() - before;

    logger.log(`✓ Parsed in ${elapsedMs}ms`);
    // Use console.log for the payload itself so it's clean for grep/jq.
    console.log(JSON.stringify(draft, null, 2));

    if (draft.lineItems.length === 0) {
      logger.warn(
        "Result has zero line items — Gemini saw the file but couldn't extract any work rows.",
      );
    }
    if (draft.warnings.length > 0) {
      logger.warn(`${draft.warnings.length} warning(s):`);
      for (const w of draft.warnings) logger.warn(`  - ${w}`);
    }
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(`[${TAG}] failed:`, err);
  process.exit(1);
});
