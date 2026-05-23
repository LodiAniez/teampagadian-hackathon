import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import { ConfigService } from "@nestjs/config";
import type { EnvConfig } from "../../../../common/config/env.schema";

const { mockGenerateContent } = vi.hoisted(() => ({ mockGenerateContent: vi.fn() }));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class GoogleGenAI {
    models = { generateContent: mockGenerateContent };
  },
  Type: {
    OBJECT: "OBJECT",
    STRING: "STRING",
    NUMBER: "NUMBER",
    ARRAY: "ARRAY",
  },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(opts: { status: number; message?: string }) {
      super(opts.message ?? "api error");
      this.status = opts.status;
    }
  },
}));

// Imported after vi.mock so the mocked client is in place.
import { ApiError } from "@google/genai";
import { GeminiService } from "../gemini.service";

const validDraft = {
  clientName: "Acme Corp",
  clientEmail: null,
  currency: "USD",
  issueDate: "2026-05-22",
  dueDate: null,
  lineItems: [],
};

function genResponse(payload: unknown) {
  return { text: JSON.stringify(payload) };
}

describe("GeminiService", () => {
  let service: GeminiService;
  let configMock: DeepMockProxy<ConfigService<EnvConfig, true>>;

  beforeEach(() => {
    mockGenerateContent.mockReset();
    configMock = mockDeep<ConfigService<EnvConfig, true>>();
    configMock.get.mockImplementation(((key: keyof EnvConfig) => {
      if (key === "GEMINI_API_KEY") return "test-gemini-key";
      if (key === "GEMINI_MODEL") return "gemini-2.5-flash";
      return undefined;
    }) as never);
    service = new GeminiService(configMock);
  });

  describe("parseInvoiceText", () => {
    it("returns the fully populated extraction on the happy path", async () => {
      mockGenerateContent.mockResolvedValue(
        genResponse({
          clientName: "Acme Corp",
          clientEmail: "ap@acme.com",
          currency: "USD",
          issueDate: "2026-05-22",
          dueDate: "2026-06-21",
          lineItems: [
            {
              description: "Landing page design",
              quantity: 1,
              unit: "project",
              rate: 1500,
              amount: 1500,
            },
          ],
        }),
      );

      const result = await service.parseInvoiceText("Bill Acme $1500 for a landing page");

      expect(result.clientName).toBe("Acme Corp");
      expect(result.dueDate).toBe("2026-06-21");
      expect(result.lineItems).toHaveLength(1);
      expect(result.lineItems[0]).toMatchObject({
        description: "Landing page design",
        quantity: 1,
        rate: 1500,
        amount: 1500,
      });
    });

    it("calls the configured model with JSON structured output", async () => {
      mockGenerateContent.mockResolvedValue(
        genResponse({
          clientName: null,
          clientEmail: null,
          currency: "USD",
          issueDate: "2026-05-22",
          dueDate: null,
          lineItems: [],
        }),
      );

      await service.parseInvoiceText("anything", "PHP");

      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
      const args = mockGenerateContent.mock.calls[0][0];
      expect(args.model).toBe("gemini-2.5-flash");
      expect(args.contents).toBe("anything");
      expect(args.config.responseMimeType).toBe("application/json");
      expect(args.config.responseSchema).toMatchObject({ type: "OBJECT" });
    });

    it("preserves nulls when Gemini cannot extract every field (partial path)", async () => {
      mockGenerateContent.mockResolvedValue(
        genResponse({
          clientName: null,
          clientEmail: null,
          currency: "USD",
          issueDate: "2026-05-22",
          dueDate: null,
          lineItems: [
            {
              description: "Consulting",
              quantity: null,
              unit: "unit",
              rate: null,
              amount: null,
            },
          ],
        }),
      );

      const result = await service.parseInvoiceText("did some consulting work");

      expect(result.clientName).toBeNull();
      expect(result.dueDate).toBeNull();
      expect(result.lineItems[0].quantity).toBeNull();
      expect(result.lineItems[0].rate).toBeNull();
      expect(result.lineItems[0].amount).toBeNull();
    });

    it("throws when Gemini returns an empty response", async () => {
      mockGenerateContent.mockResolvedValue({ text: undefined });

      await expect(service.parseInvoiceText("nonsense")).rejects.toThrow();
    });

    it("throws when Gemini returns malformed JSON", async () => {
      mockGenerateContent.mockResolvedValue({ text: "not json at all" });

      await expect(service.parseInvoiceText("nonsense")).rejects.toThrow();
    });

    it("throws when the JSON does not match the schema", async () => {
      mockGenerateContent.mockResolvedValue(genResponse({ clientName: "Acme" }));

      await expect(service.parseInvoiceText("missing fields")).rejects.toThrow();
    });

    it("anchors the prompt with today's date so relative dates can be resolved", async () => {
      mockGenerateContent.mockResolvedValue(genResponse(validDraft));

      await service.parseInvoiceText("due in 30 days");

      const today = new Date().toISOString().slice(0, 10);
      const args = mockGenerateContent.mock.calls[0][0];
      expect(args.config.systemInstruction).toContain(today);
    });

    it("retries once on a transient 503 and then succeeds", async () => {
      mockGenerateContent
        .mockRejectedValueOnce(new ApiError({ status: 503, message: "service unavailable" }))
        .mockResolvedValueOnce(genResponse({ ...validDraft, clientName: "Retried Co" }));

      const result = await service.parseInvoiceText("anything");

      expect(mockGenerateContent).toHaveBeenCalledTimes(2);
      expect(result.clientName).toBe("Retried Co");
    });

    it("does not retry a quota error (429) and surfaces a clean error", async () => {
      mockGenerateContent.mockRejectedValue(
        new ApiError({ status: 429, message: "quota exceeded, limit: 0" }),
      );

      await expect(service.parseInvoiceText("anything")).rejects.toThrow(
        /AI service is unavailable/,
      );
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });

    it("does not leak the raw upstream error message to the caller", async () => {
      mockGenerateContent.mockRejectedValue(
        new ApiError({ status: 429, message: "quota exceeded, limit: 0" }),
      );

      await expect(service.parseInvoiceText("anything")).rejects.not.toThrow(/quota/);
    });
  });
});
