import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FxRateService } from "./fx-rate.service";

const okResponse = (rates: Record<string, number>): Response =>
  new Response(JSON.stringify({ result: "success", base_code: "USD", rates }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

describe("FxRateService", () => {
  let service: FxRateService;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    service = new FxRateService();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("getRate", () => {
    it("returns the live rate from the API", async () => {
      fetchMock.mockResolvedValueOnce(okResponse({ PHP: 56.42 }));

      const rate = await service.getRate("USD", "PHP");

      expect(rate).toBe(56.42);
      expect(fetchMock).toHaveBeenCalledWith("https://open.er-api.com/v6/latest/USD");
    });

    it("returns the cached rate on a second call within the TTL", async () => {
      fetchMock.mockResolvedValueOnce(okResponse({ PHP: 56.42 }));

      await service.getRate("USD", "PHP");
      vi.advanceTimersByTime(4 * 60 * 1000); // 4 min — still within 5-min TTL
      const rate = await service.getRate("USD", "PHP");

      expect(rate).toBe(56.42);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("re-fetches after the TTL expires", async () => {
      fetchMock
        .mockResolvedValueOnce(okResponse({ PHP: 56.42 }))
        .mockResolvedValueOnce(okResponse({ PHP: 57.1 }));

      await service.getRate("USD", "PHP");
      vi.advanceTimersByTime(6 * 60 * 1000); // past 5-min TTL
      const rate = await service.getRate("USD", "PHP");

      expect(rate).toBe(57.1);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("falls back to the hardcoded rate when the network fails", async () => {
      fetchMock.mockRejectedValueOnce(new Error("Network unreachable"));

      const rate = await service.getRate("USD", "PHP");

      expect(rate).toBe(55.79);
    });

    it("falls back when the API returns a non-OK status", async () => {
      fetchMock.mockResolvedValueOnce(new Response("rate limited", { status: 429 }));

      const rate = await service.getRate("USD", "PHP");

      expect(rate).toBe(55.79);
    });

    it("falls back when the requested currency is missing from the response", async () => {
      fetchMock.mockResolvedValueOnce(okResponse({ EUR: 0.92 }));

      const rate = await service.getRate("USD", "PHP");

      expect(rate).toBe(55.79);
    });

    it("falls back when the API returns a malformed body", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ result: "error" }), { status: 200 }),
      );

      const rate = await service.getRate("USD", "PHP");

      expect(rate).toBe(55.79);
    });
  });

  describe("getFallbackRate", () => {
    it("returns the hardcoded USD_PHP rate", () => {
      expect(service.getFallbackRate("USD", "PHP")).toBe(55.79);
    });

    it("returns the hardcoded EUR_PHP rate", () => {
      expect(service.getFallbackRate("EUR", "PHP")).toBe(60.45);
    });

    it("returns the default for unknown currency pairs", () => {
      expect(service.getFallbackRate("XYZ", "ABC")).toBe(55.0);
    });

    it("is case-insensitive", () => {
      expect(service.getFallbackRate("usd", "php")).toBe(55.79);
    });
  });
});
