import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FxRateService } from "../integrations/fx/fx-rate.service";
import { FxCompareService } from "./fx-compare.service";

describe("FxCompareService", () => {
  let service: FxCompareService;
  let getRate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    getRate = vi.fn().mockResolvedValue(56.0);

    const moduleRef = await Test.createTestingModule({
      providers: [FxCompareService, { provide: FxRateService, useValue: { getRate } }],
    }).compile();

    service = moduleRef.get(FxCompareService);
  });

  it("uses the live USD->PHP rate from FxRateService", async () => {
    const result = await service.compare(1000);

    expect(getRate).toHaveBeenCalledWith("USD", "PHP");
    expect(result.phpRate).toBe(56.0);
    expect(result.usdAmount).toBe(1000);
  });

  it("returns the four providers in display order raket, paypal, wise, bank", async () => {
    const result = await service.compare(1000);

    expect(result.providers.map((p) => p.provider)).toEqual(["raket", "paypal", "wise", "bank"]);
  });

  it("charges Raket 0.5% of gross with a zero delta against itself", async () => {
    const raket = (await service.compare(1000)).providers[0];

    expect(raket).toMatchObject({
      provider: "raket",
      feePct: 0.5,
      feePhp: 280,
      receivedPhp: 55720,
      deltaVsRaketPhp: 0,
    });
  });

  it("charges PayPal 6.9% of gross", async () => {
    const paypal = (await service.compare(1000)).providers[1];

    expect(paypal.feePct).toBeCloseTo(6.9, 5);
    expect(paypal.feePhp).toBeCloseTo(3864, 5);
    expect(paypal.receivedPhp).toBeCloseTo(52136, 5);
    // raket 55720 - paypal 52136
    expect(paypal.deltaVsRaketPhp).toBeCloseTo(3584, 5);
  });

  it("charges Wise 0.65% of gross (now pricier than Raket's 0.5%, so its delta is positive)", async () => {
    const wise = (await service.compare(1000)).providers[2];

    expect(wise.feePct).toBeCloseTo(0.65, 5);
    expect(wise.feePhp).toBeCloseTo(364, 5);
    expect(wise.receivedPhp).toBeCloseTo(55636, 5);
    // raket 55720 - wise 55636
    expect(wise.deltaVsRaketPhp).toBeCloseTo(84, 5);
  });

  it("charges the bank a 2% spread plus a flat $30 wire fee, shown as an effective %", async () => {
    const bank = (await service.compare(1000)).providers[3];

    // grossPhp*0.02 + 30*rate = 56000*0.02 + 30*56 = 1120 + 1680 = 2800
    expect(bank.feePhp).toBeCloseTo(2800, 5);
    expect(bank.receivedPhp).toBeCloseTo(53200, 5);
    // effective % = 2800 / 56000 * 100 = 5.0
    expect(bank.feePct).toBeCloseTo(5.0, 5);
    // raket 55720 - bank 53200
    expect(bank.deltaVsRaketPhp).toBeCloseTo(2520, 5);
  });

  it("makes every delta non-negative now that Raket is the cheapest provider", async () => {
    const result = await service.compare(1000);

    for (const p of result.providers) {
      expect(p.deltaVsRaketPhp).toBeGreaterThanOrEqual(0);
    }
  });

  it("reports savedVsPaypalPhp as Raket's net minus PayPal's net", async () => {
    const result = await service.compare(1000);

    // raket 55720 - paypal 52136
    expect(result.savedVsPaypalPhp).toBeCloseTo(3584, 5);
  });

  it("never returns a negative receivedPhp for a normal amount", async () => {
    const result = await service.compare(1000);

    for (const p of result.providers) {
      expect(p.receivedPhp).toBeGreaterThanOrEqual(0);
    }
  });

  it("clamps receivedPhp to zero for a tiny amount where the bank's flat fee exceeds gross", async () => {
    // usd=20 @ 56 → gross 1120; bank fee = 1120*0.02 + 30*56 = 1702.4 > gross,
    // which would make receivedPhp negative and violate the contract's
    // nonnegative() guard if left unclamped.
    const result = await service.compare(20);

    for (const p of result.providers) {
      expect(p.receivedPhp).toBeGreaterThanOrEqual(0);
    }
    expect(result.providers[3].receivedPhp).toBe(0);
  });
});
