"use client";

import { useCallback, useEffect, useState } from "react";

export function useResendCooldown(seconds: number) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => {
      setRemaining((r) => (r > 0 ? r - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [remaining]);

  const start = useCallback(() => {
    setRemaining(seconds);
  }, [seconds]);

  return {
    remaining,
    isReady: remaining <= 0,
    start,
  };
}
