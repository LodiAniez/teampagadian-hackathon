import { useRouter } from "expo-router";
import { useSettlementAnimation } from "../hooks/use-settlement-animation";
import { SettlementAnimationView } from "./SettlementAnimationView";
import type { PayoutLandedEvent } from "../types";

/**
 * Adapter between {@link useSettlementAnimation} and the pure view. Owns the
 * "done" navigation back to the dashboard (caches were already invalidated by
 * the hook when the animation finished).
 */
export function SettlementAnimation({ event }: { event: PayoutLandedEvent }) {
  const router = useRouter();
  const vm = useSettlementAnimation(event);

  const onDone = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  return <SettlementAnimationView {...vm} onDone={onDone} />;
}
