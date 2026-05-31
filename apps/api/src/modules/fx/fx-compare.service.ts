import { Injectable } from "@nestjs/common";
import type { FxComparison, FxProviderComparison } from "@raket/contracts";
import { FxRateService } from "../integrations/fx/fx-rate.service";

// Deterministic fee models locked in TEA-51. PayPal's 6.9% mirrors the
// `* 0.069` assumption baked into dashboard.service.ts's savings KPI — keep the
// two in sync if either changes (we deliberately don't import across slices).
// Raket undercuts every competitor (Wise's 0.65% included), so the "Best rate"
// claim holds and every deltaVsRaketPhp is >= 0.
const RAKET_PCT = 0.005;
const PAYPAL_PCT = 0.069;
const WISE_PCT = 0.0065;
const BANK_SPREAD_PCT = 0.02;
const BANK_FLAT_USD = 30;

@Injectable()
export class FxCompareService {
  constructor(private readonly fxRate: FxRateService) {}

  /**
   * Compares what a USD amount nets a freelancer via Raket vs PayPal, Wise, and
   * a bank wire, using the current USD->PHP rate. Public calculator — no auth.
   */
  async compare(usd: number): Promise<FxComparison> {
    const rate = await this.fxRate.getRate("USD", "PHP");
    const grossPhp = usd * rate;

    // Build Raket first so every other row can be diffed against its net.
    const raketReceivedPhp = clampPhp(round(grossPhp - grossPhp * RAKET_PCT));

    const row = (
      provider: FxProviderComparison["provider"],
      label: string,
      feePhp: number,
    ): FxProviderComparison => {
      // Clamp to 0: the bank's flat $30 wire fee can exceed gross on tiny
      // invoices, which would otherwise go negative and break the contract's
      // receivedPhp.nonnegative() guard. Diff the delta off the clamped net so
      // the displayed "vs Raket" figure matches the shown receivedPhp.
      const receivedPhp = clampPhp(round(grossPhp - feePhp));
      return {
        provider,
        label,
        feePct: round((feePhp / grossPhp) * 100),
        feePhp: round(feePhp),
        receivedPhp,
        deltaVsRaketPhp: round(raketReceivedPhp - receivedPhp),
      };
    };

    const providers: FxProviderComparison[] = [
      row("raket", "Raket", grossPhp * RAKET_PCT),
      row("paypal", "PayPal", grossPhp * PAYPAL_PCT),
      row("wise", "Wise", grossPhp * WISE_PCT),
      row("bank", "Bank wire", grossPhp * BANK_SPREAD_PCT + BANK_FLAT_USD * rate),
    ];

    const paypalReceivedPhp = providers[1].receivedPhp;

    return {
      usdAmount: usd,
      phpRate: rate,
      providers,
      savedVsPaypalPhp: round(providers[0].receivedPhp - paypalReceivedPhp),
    };
  }
}

// Money/percent values are display-bound; round to 2 dp to keep float noise
// (e.g. 56000 * 0.069 = 3863.999…) out of the response.
const round = (n: number): number => Math.round(n * 100) / 100;

// Never report a negative net — see the bank flat-fee note in `row`.
const clampPhp = (n: number): number => Math.max(0, n);
