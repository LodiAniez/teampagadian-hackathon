import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  authHeader: vi.fn(),
}));

vi.mock("@/lib/form-data", async () => {
  const actual = await vi.importActual<typeof import("@/lib/form-data")>("@/lib/form-data");
  return {
    ...actual,
    postMultipart: vi.fn(),
  };
});

const VALID_ENV = {
  EXPO_PUBLIC_API_URL: "https://api.example.test",
  EXPO_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  EXPO_PUBLIC_SUPABASE_ANON_KEY: "anon-key-12345",
  EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_12345",
};

const validDraftResponse = {
  clientName: "Acme",
  clientEmail: "ap@acme.example",
  currency: "USD",
  issueDate: "2026-05-28",
  dueDate: "2026-06-27",
  lineItems: [{ description: "Design", quantity: 10, unit: "hour", rate: 75, amount: 750 }],
  warnings: [],
};

describe("parseQuotationRequest", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...originalEnv, ...VALID_ENV };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns a parsed draft on 200 with a valid ParsedInvoiceDraft body", async () => {
    const { authHeader } = await import("@/lib/auth");
    const { postMultipart } = await import("@/lib/form-data");
    vi.mocked(authHeader).mockResolvedValue({ authorization: "Bearer test-token" });
    vi.mocked(postMultipart).mockResolvedValue({ status: 200, body: validDraftResponse });

    const { parseQuotationRequest } = await import("./use-parse-quotation");

    const draft = await parseQuotationRequest({
      file: { uri: "file:///q.pdf", name: "q.pdf", mimeType: "application/pdf" },
    });

    expect(draft.clientName).toBe("Acme");
    expect(draft.lineItems).toHaveLength(1);
  });

  it("calls postMultipart with the right URL, FormData body, and Bearer header", async () => {
    const { authHeader } = await import("@/lib/auth");
    const { postMultipart } = await import("@/lib/form-data");
    vi.mocked(authHeader).mockResolvedValue({ authorization: "Bearer test-token" });
    vi.mocked(postMultipart).mockResolvedValue({ status: 200, body: validDraftResponse });

    const { parseQuotationRequest } = await import("./use-parse-quotation");
    await parseQuotationRequest({
      file: { uri: "file:///q.pdf", name: "q.pdf", mimeType: "application/pdf" },
    });

    expect(postMultipart).toHaveBeenCalledTimes(1);
    const [url, body, headers] = vi.mocked(postMultipart).mock.calls[0];
    expect(url).toBe("https://api.example.test/api/v1/invoices/parse-quotation");
    expect(body).toBeInstanceOf(FormData);
    expect(headers).toEqual({ authorization: "Bearer test-token" });
  });

  it("includes defaultCurrency as a form field when provided", async () => {
    const { authHeader } = await import("@/lib/auth");
    const { postMultipart } = await import("@/lib/form-data");
    vi.mocked(authHeader).mockResolvedValue({ authorization: "Bearer t" });
    vi.mocked(postMultipart).mockResolvedValue({ status: 200, body: validDraftResponse });

    const { parseQuotationRequest } = await import("./use-parse-quotation");
    await parseQuotationRequest({
      file: { uri: "file:///q.pdf", name: "q.pdf", mimeType: "application/pdf" },
      defaultCurrency: "PHP",
    });

    const body = vi.mocked(postMultipart).mock.calls[0][1];
    expect(body.get("defaultCurrency")).toBe("PHP");
  });

  it("omits defaultCurrency when not provided", async () => {
    const { authHeader } = await import("@/lib/auth");
    const { postMultipart } = await import("@/lib/form-data");
    vi.mocked(authHeader).mockResolvedValue({ authorization: "Bearer t" });
    vi.mocked(postMultipart).mockResolvedValue({ status: 200, body: validDraftResponse });

    const { parseQuotationRequest } = await import("./use-parse-quotation");
    await parseQuotationRequest({
      file: { uri: "file:///q.pdf", name: "q.pdf", mimeType: "application/pdf" },
    });

    const body = vi.mocked(postMultipart).mock.calls[0][1];
    expect(body.get("defaultCurrency")).toBeNull();
  });

  it("throws ParseQuotationError with the status on 413", async () => {
    const { authHeader } = await import("@/lib/auth");
    const { postMultipart } = await import("@/lib/form-data");
    vi.mocked(authHeader).mockResolvedValue({ authorization: "Bearer t" });
    vi.mocked(postMultipart).mockResolvedValue({
      status: 413,
      body: { code: "FILE_TOO_LARGE", message: "too big", requestId: "r1" },
    });

    const { parseQuotationRequest, ParseQuotationError } = await import("./use-parse-quotation");

    try {
      await parseQuotationRequest({
        file: { uri: "file:///q.pdf", name: "q.pdf", mimeType: "application/pdf" },
      });
      expect.fail("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ParseQuotationError);
      const e = err as InstanceType<typeof ParseQuotationError>;
      expect(e.status).toBe(413);
      expect(e.body?.code).toBe("FILE_TOO_LARGE");
    }
  });

  it("throws ParseQuotationError on 415", async () => {
    const { authHeader } = await import("@/lib/auth");
    const { postMultipart } = await import("@/lib/form-data");
    vi.mocked(authHeader).mockResolvedValue({ authorization: "Bearer t" });
    vi.mocked(postMultipart).mockResolvedValue({
      status: 415,
      body: { code: "INTERNAL", message: "bad mime" },
    });

    const { parseQuotationRequest, ParseQuotationError } = await import("./use-parse-quotation");

    try {
      await parseQuotationRequest({
        file: { uri: "file:///q.pdf", name: "q.pdf", mimeType: "application/pdf" },
      });
      expect.fail("expected throw");
    } catch (err) {
      const e = err as InstanceType<typeof ParseQuotationError>;
      expect(e.status).toBe(415);
    }
  });

  it("throws ParseQuotationError on 500", async () => {
    const { authHeader } = await import("@/lib/auth");
    const { postMultipart } = await import("@/lib/form-data");
    vi.mocked(authHeader).mockResolvedValue({ authorization: "Bearer t" });
    vi.mocked(postMultipart).mockResolvedValue({
      status: 500,
      body: { code: "INTERNAL", message: "ai unavailable" },
    });

    const { parseQuotationRequest, ParseQuotationError } = await import("./use-parse-quotation");

    try {
      await parseQuotationRequest({
        file: { uri: "file:///q.pdf", name: "q.pdf", mimeType: "application/pdf" },
      });
      expect.fail("expected throw");
    } catch (err) {
      const e = err as InstanceType<typeof ParseQuotationError>;
      expect(e.status).toBe(500);
    }
  });

  it("throws ParseQuotationError with null body if the error response isn't JSON-shaped", async () => {
    const { authHeader } = await import("@/lib/auth");
    const { postMultipart } = await import("@/lib/form-data");
    vi.mocked(authHeader).mockResolvedValue({ authorization: "Bearer t" });
    // postMultipart returns body: null when the response wasn't JSON-parseable
    vi.mocked(postMultipart).mockResolvedValue({ status: 502, body: null });

    const { parseQuotationRequest, ParseQuotationError } = await import("./use-parse-quotation");

    try {
      await parseQuotationRequest({
        file: { uri: "file:///q.pdf", name: "q.pdf", mimeType: "application/pdf" },
      });
      expect.fail("expected throw");
    } catch (err) {
      const e = err as InstanceType<typeof ParseQuotationError>;
      expect(e.status).toBe(502);
      expect(e.body).toBeNull();
    }
  });

  it("throws when the 200 response body doesn't match ParsedInvoiceDraftSchema", async () => {
    const { authHeader } = await import("@/lib/auth");
    const { postMultipart } = await import("@/lib/form-data");
    vi.mocked(authHeader).mockResolvedValue({ authorization: "Bearer t" });
    vi.mocked(postMultipart).mockResolvedValue({
      status: 200,
      body: { clientName: "Acme" /* missing fields */ },
    });

    const { parseQuotationRequest } = await import("./use-parse-quotation");

    await expect(
      parseQuotationRequest({
        file: { uri: "file:///q.pdf", name: "q.pdf", mimeType: "application/pdf" },
      }),
    ).rejects.toThrow();
  });
});
