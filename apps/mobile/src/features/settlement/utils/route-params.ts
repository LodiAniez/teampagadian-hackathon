import type { PayoutLandedEvent } from "../types";

type RawParams = Record<string, string | string[] | undefined>;

/** Expo Router params may arrive as `string | string[]`; take the first value. */
function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Build a {@link PayoutLandedEvent} from settlement-screen route params. */
export function parseSettlementParams(params: RawParams): PayoutLandedEvent {
  const payoutId = first(params.payoutId) ?? `unknown-${Date.now()}`;
  const amountRaw = first(params.amountPhp);
  const amountPhp = amountRaw !== undefined && amountRaw !== "" ? Number(amountRaw) : NaN;
  const clientName = first(params.clientName);

  return {
    payoutId,
    amountPhp: Number.isFinite(amountPhp) ? amountPhp : 0,
    ...(clientName ? { clientName } : {}),
  };
}
