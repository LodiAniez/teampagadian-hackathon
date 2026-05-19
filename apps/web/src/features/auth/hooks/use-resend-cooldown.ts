"use client";

import { useCallback, useEffect, useState } from "react";

export function useResendCooldown(seconds: number) {
  const [remaining, setRemaining] = useState(0);
  const isActive = remaining > 0;

  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => {
      setRemaining((r) => (r > 0 ? r - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [isActive]);

  const start = useCallback(() => {
    setRemaining(seconds);
  }, [seconds]);

  return {
    remaining,
    isReady: !isActive,
    start,
  };
}
