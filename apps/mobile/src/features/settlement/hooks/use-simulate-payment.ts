import { useRouter } from "expo-router";
import { impactMedium } from "@/lib/haptics";

/**
 * Stage-failover trigger: routes to the settlement animation with demo amounts,
 * exercising the exact same screen a real `payouts` INSERT would, minus the
 * webhook. Consumed only by the dev-build FAB.
 */
export function useSimulatePayment() {
  const router = useRouter();

  const simulate = () => {
    impactMedium();
    router.push({
      pathname: "/settlement",
      params: {
        payoutId: `sim-${Date.now()}`,
        amountPhp: "83685",
        clientName: "Acme Northwind",
      },
    });
  };

  return { simulate };
}
