import { describe, expect, it } from "vitest";
import { QUOTATION_MAX_BYTES } from "@raket/contracts";
import { ParseQuotationError } from "../hooks/parse-quotation-error";
import { messageForUploadError, validatePickedAsset } from "./upload-validation";

describe("validatePickedAsset", () => {
  it("accepts a small PDF", () => {
    const result = validatePickedAsset({
      uri: "file:///q.pdf",
      name: "q.pdf",
      mimeType: "application/pdf",
      size: 1000,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.file.mimeType).toBe("application/pdf");
      expect(result.file.size).toBe(1000);
    }
  });

  it("accepts PNG and JPEG", () => {
    expect(
      validatePickedAsset({ uri: "u", name: "x.png", mimeType: "image/png", size: 1 }).ok,
    ).toBe(true);
    expect(
      validatePickedAsset({ uri: "u", name: "x.jpg", mimeType: "image/jpeg", size: 1 }).ok,
    ).toBe(true);
  });

  it("rejects a file larger than QUOTATION_MAX_BYTES", () => {
    const result = validatePickedAsset({
      uri: "u",
      name: "big.pdf",
      mimeType: "application/pdf",
      size: QUOTATION_MAX_BYTES + 1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/5 MB/);
    }
  });

  it("rejects an unsupported MIME type (e.g., text/plain)", () => {
    const result = validatePickedAsset({
      uri: "u",
      name: "n.txt",
      mimeType: "text/plain",
      size: 100,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/PDF|PNG|JPEG/);
    }
  });

  it("rejects when mimeType is missing entirely", () => {
    const result = validatePickedAsset({ uri: "u", name: "n", size: 100 });
    expect(result.ok).toBe(false);
  });

  it("rejects when mimeType is null", () => {
    const result = validatePickedAsset({ uri: "u", name: "n", mimeType: null, size: 100 });
    expect(result.ok).toBe(false);
  });

  it("treats missing size as ok (some pickers don't populate it)", () => {
    const result = validatePickedAsset({
      uri: "u",
      name: "n.pdf",
      mimeType: "application/pdf",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.file.size).toBe(0);
    }
  });
});

describe("messageForUploadError", () => {
  it("maps 413 to the size message", () => {
    const err = new ParseQuotationError(413, { code: "FILE_TOO_LARGE", message: "too big" });
    expect(messageForUploadError(err)).toMatch(/5 MB/);
  });

  it("maps 415 to the MIME message", () => {
    const err = new ParseQuotationError(415, { code: "INTERNAL", message: "bad mime" });
    expect(messageForUploadError(err)).toMatch(/PDF|PNG|JPEG/);
  });

  it("maps 422 to a generic try-another", () => {
    const err = new ParseQuotationError(422, { code: "VALIDATION_FAILED", message: "no file" });
    expect(messageForUploadError(err)).toMatch(/try another/i);
  });

  it("maps 429 to a rate-limit message", () => {
    const err = new ParseQuotationError(429, { code: "RATE_LIMITED", message: "too many" });
    expect(messageForUploadError(err)).toMatch(/try again in a minute/i);
  });

  it("maps 500/502/503/504 to AI-unavailable", () => {
    for (const status of [500, 502, 503, 504]) {
      const err = new ParseQuotationError(status, null);
      expect(messageForUploadError(err)).toMatch(/AI service is unavailable/);
    }
  });

  it("falls back to the body.message for other statuses", () => {
    const err = new ParseQuotationError(418, { code: "INTERNAL", message: "I'm a teapot" });
    expect(messageForUploadError(err)).toBe("I'm a teapot");
  });

  it("maps network-error strings to a connectivity message", () => {
    expect(messageForUploadError(new Error("Network error"))).toMatch(/connection/i);
    expect(messageForUploadError(new Error("Network timeout"))).toMatch(/connection/i);
  });

  it("returns a generic message for unrecognised errors", () => {
    expect(messageForUploadError("string error")).toBe("Upload failed — please try again");
    expect(messageForUploadError(null)).toBe("Upload failed — please try again");
  });
});
