"use client";

import { useEffect } from "react";
import { useOtpVerify } from "../hooks/use-otp-verify";
import { useResendCooldown } from "../hooks/use-resend-cooldown";
import { useResendOtp } from "../hooks/use-resend-otp";
import { OtpVerifyFormView } from "./OtpVerifyFormView";

const RESEND_COOLDOWN_SECONDS = 30;

type Props = { phone: string };

export function OtpVerifyForm({ phone }: Props) {
  const { code, setCode, isSubmitting, error } = useOtpVerify({ phone });
  const { remaining, isReady, start: startCooldown } = useResendCooldown(RESEND_COOLDOWN_SECONDS);
  const { resend, isResending } = useResendOtp({
    phone,
    onSuccess: startCooldown,
  });

  useEffect(() => {
    startCooldown();
  }, [startCooldown]);

  return (
    <OtpVerifyFormView
      phone={phone}
      code={code}
      setCode={setCode}
      isSubmitting={isSubmitting || isResending}
      error={error}
      resendIsReady={isReady}
      resendRemaining={remaining}
      onResend={() => {
        void resend();
      }}
    />
  );
}
