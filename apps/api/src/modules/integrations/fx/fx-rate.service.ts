import { Injectable, Logger } from "@nestjs/common";
import { z } from "zod";

const FxApiResponseSchema = z.object({
  result: z.literal("success"),
  base_code: z.string(),
  rates: z.record(z.number()),
});

const FX_API_BASE_URL = "https://open.er-api.com/v6/latest";
const CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_FALLBACK_RATE = 55.0;
const FALLBACK_RATES: Record<string, number> = {
  USD_PHP: 55.79,
  EUR_PHP: 60.45,
  GBP_PHP: 71.2,
  AUD_PHP: 37.8,
  CAD_PHP: 41.2,
};

interface CacheEntry {
  rate: number;
  fetchedAt: number;
}

@Injectable()
export class FxRateService {
  private readonly logger = new Logger(FxRateService.name);
  private readonly cache = new Map<string, CacheEntry>();

  async getRate(from: string, to: string): Promise<number> {
    const fromUpper = from.toUpperCase();
    const toUpper = to.toUpperCase();
    const key = `${fromUpper}_${toUpper}`;

    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      this.logger.log(`FX ${key} cache hit: ${cached.rate}`);
      return cached.rate;
    }

    try {
      const rate = await this.fetchLiveRate(fromUpper, toUpper);
      this.cache.set(key, { rate, fetchedAt: Date.now() });
      this.logger.log(`FX ${key} live: ${rate}`);
      return rate;
    } catch (err) {
      const fallback = this.getFallbackRate(from, to);
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`FX ${key} live failed (${message}); falling back to ${fallback}`);
      return fallback;
    }
  }

  getFallbackRate(from: string, to: string): number {
    const key = `${from.toUpperCase()}_${to.toUpperCase()}`;
    return FALLBACK_RATES[key] ?? DEFAULT_FALLBACK_RATE;
  }

  private async fetchLiveRate(from: string, to: string): Promise<number> {
    const response = await fetch(`${FX_API_BASE_URL}/${from}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const parsed = FxApiResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new Error(`Malformed FX response: ${parsed.error.message}`);
    }
    const rate = parsed.data.rates[to];
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
      throw new Error(`Rate ${from}->${to} not present in response`);
    }
    return rate;
  }
}
