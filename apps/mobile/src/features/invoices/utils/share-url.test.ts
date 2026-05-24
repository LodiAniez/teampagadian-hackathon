import { describe, expect, it } from "vitest";
import { buildInvoiceShareUrl } from "./share-url";

describe("buildInvoiceShareUrl", () => {
  it("composes the public pay URL from app URL + invoice id", () => {
    expect(buildInvoiceShareUrl("abc-123", "https://raket.app")).toBe(
      "https://raket.app/pay/abc-123",
    );
  });

  it("strips a trailing slash on the app URL so we don't emit '//pay/...'", () => {
    expect(buildInvoiceShareUrl("abc-123", "https://raket.app/")).toBe(
      "https://raket.app/pay/abc-123",
    );
  });

  it("collapses multiple trailing slashes", () => {
    expect(buildInvoiceShareUrl("abc-123", "https://raket.app///")).toBe(
      "https://raket.app/pay/abc-123",
    );
  });

  it("URL-encodes the invoice id so a malformed id can't break the URL", () => {
    expect(buildInvoiceShareUrl("with spaces & symbols", "https://raket.app")).toBe(
      "https://raket.app/pay/with%20spaces%20%26%20symbols",
    );
  });

  it("works with localhost dev URLs", () => {
    expect(buildInvoiceShareUrl("id-1", "http://localhost:3000")).toBe(
      "http://localhost:3000/pay/id-1",
    );
  });
});
