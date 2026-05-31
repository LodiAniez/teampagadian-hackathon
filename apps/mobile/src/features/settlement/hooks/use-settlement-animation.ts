import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { notificationSuccess } from "@/lib/haptics";
import { SETTLEMENT_STEP_COUNT, SETTLEMENT_STEP_TIMINGS_MS } from "../constants";
import { buildLandedToast } from "../utils/build-toast";
import { buildSettlementCompleteHandler } from "../utils/settlement-complete";
import { buildSettlementHero, buildSettlementSteps } from "../utils/settlement-steps";
import type { PayoutLandedEvent } from "../types";

const LAST_STEP = SETTLEMENT_STEP_COUNT - 1;
const DONE = SETTLEMENT_STEP_COUNT;

export type SettlementAnimationVm = {
  steps: { title: string; meta: string; state: "pending" | "active" | "done" }[];
  heroTitle: string;
  heroSub: string;
  /** 0..1 — fraction of the ring filled. */
  progress: number;
  /** 0..100, rounded — the number shown in the ring centre. */
  progressPct: number;
  isDone: boolean;
  toastVisible: boolean;
  toastMessage: string;
  onRestart: () => void;
};

/**
 * Drives the 6-step settlement timeline on a timer (matching the mock's
 * cadence), surfaces a per-step view-model, fires a success haptic + toast at
 * the end, and invalidates the dashboard/invoices caches so the UI refreshes.
 */
export function useSettlementAnimation(event: PayoutLandedEvent): SettlementAnimationVm {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);

  const stepLabels = useMemo(() => buildSettlementSteps(event), [event]);
  const heroes = useMemo(() => buildSettlementHero(), []);
  const toastMessage = useMemo(() => buildLandedToast(event), [event]);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    let elapsed = 0;
    // Schedule each transition at the cumulative dwell time of the prior steps,
    // then a final tick into the DONE state once the last step has shown.
    for (let next = 1; next <= DONE; next++) {
      elapsed += SETTLEMENT_STEP_TIMINGS_MS[next - 1];
      timers.push(setTimeout(() => setStep(next), elapsed));
    }
    return () => timers.forEach(clearTimeout);
  }, [event]);

  const isDone = step >= DONE;

  useEffect(() => {
    if (!isDone) return;
    notificationSuccess();
    void buildSettlementCompleteHandler({ queryClient })();
  }, [isDone, queryClient]);

  const onRestart = useCallback(() => setStep(0), []);

  // Ring fills from step 0 (0%) to the final step (100%); clamp once done.
  const filledStep = Math.min(step, LAST_STEP);
  const progress = filledStep / LAST_STEP;

  return {
    steps: stepLabels.map((s, i) => ({
      ...s,
      state: i < step ? "done" : i === step ? "active" : "pending",
    })),
    heroTitle: heroes[Math.min(step, LAST_STEP)].title,
    heroSub: heroes[Math.min(step, LAST_STEP)].sub,
    progress,
    progressPct: Math.round(progress * 100),
    isDone,
    toastVisible: isDone,
    toastMessage,
    onRestart,
  };
}
