import { describe, expect, it } from "vitest";
import { normalizeError } from "./error";

describe("normalizeError", () => {
  it("returns null for falsy input", () => {
    expect(normalizeError(null)).toBeNull();
    expect(normalizeError(undefined)).toBeNull();
  });

  it("extracts message from a ts-rest ErrorResponse-style object (body.message)", () => {
    const tsRestError = {
      status: 422,
      body: { code: "VALIDATION_FAILED", message: "Either clientId or clientName is required" },
      headers: new Headers(),
    };
    expect(normalizeError(tsRestError)).toEqual({
      message: "Either clientId or clientName is required",
    });
  });

  it("falls back to a plain Error's message", () => {
    const networkError = new Error("Network request failed");
    expect(normalizeError(networkError)).toEqual({ message: "Network request failed" });
  });

  it("returns a generic message when no message can be extracted", () => {
    expect(normalizeError({ random: "thing" })).toEqual({ message: "Request failed" });
  });
});
