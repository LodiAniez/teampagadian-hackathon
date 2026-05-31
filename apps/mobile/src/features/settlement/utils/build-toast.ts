import { formatPhp } from "@/lib/format";
import { withDefaults } from "../constants";
import type { PayoutLandedEvent } from "../types";

/** The "money landed" toast copy: "₱<amount> received from <client>". */
export function buildLandedToast(event: PayoutLandedEvent): string {
  const { amountPhp, clientName } = withDefaults(event);
  return `${formatPhp(amountPhp)} received from ${clientName}`;
}
