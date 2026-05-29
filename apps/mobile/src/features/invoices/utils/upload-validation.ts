import {
  QUOTATION_MAX_BYTES,
  QUOTATION_MIME_TYPES,
  type QuotationMimeType,
} from "@raket/contracts";
import { ParseQuotationError } from "../hooks/parse-quotation-error";
import type { UploadSelectedFile } from "../types";

// Shape of what expo-document-picker returns. We declare a structural subset
// to avoid importing the SDK from a pure module and to keep tests trivial.
export type PickedAsset = {
  uri: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
};

export type PickValidationResult =
  | { ok: true; file: UploadSelectedFile }
  | { ok: false; error: string };

// Client-side pre-flight: matches the server-side checks in TEA-30
// (apps/api/src/modules/invoices/invoices.service.ts) so users see immediate
// feedback without burning a network round-trip + Gemini quota on bad files.
export function validatePickedAsset(asset: PickedAsset): PickValidationResult {
  if (typeof asset.size === "number" && asset.size > QUOTATION_MAX_BYTES) {
    return { ok: false, error: "File is too large — max 5 MB" };
  }
  if (!asset.mimeType || !isQuotationMimeType(asset.mimeType)) {
    return { ok: false, error: "Unsupported file type — pick a PDF, PNG, or JPEG" };
  }
  return {
    ok: true,
    file: {
      uri: asset.uri,
      name: asset.name,
      size: asset.size ?? 0,
      mimeType: asset.mimeType,
    },
  };
}

// Server errors that escape client-side validation (e.g., picker lied about
// MIME on Android) map to the same user-friendly copy as the local errors so
// the user sees one consistent message regardless of where it was caught.
export function messageForUploadError(err: unknown): string {
  if (err instanceof ParseQuotationError) {
    switch (err.status) {
      case 413:
        return "File is too large — max 5 MB";
      case 415:
        return "Unsupported file type — pick a PDF, PNG, or JPEG";
      case 422:
        return "Couldn't read that file — try another";
      case 429:
        return "Too many uploads — please try again in a minute";
      case 500:
      case 502:
      case 503:
      case 504:
        return "AI service is unavailable — please try again";
      default:
        return err.body?.message ?? "Upload failed — please try again";
    }
  }
  // Non-HTTP errors (network failure, XHR ontimeout/onerror) bubble through as
  // plain Error from postMultipart.
  if (err instanceof Error && /network/i.test(err.message)) {
    return "Couldn't reach the server — check your connection";
  }
  return "Upload failed — please try again";
}

function isQuotationMimeType(value: string): value is QuotationMimeType {
  return (QUOTATION_MIME_TYPES as readonly string[]).includes(value);
}
