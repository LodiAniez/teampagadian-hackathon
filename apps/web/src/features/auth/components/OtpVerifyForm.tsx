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
  const cooldown = useResendCooldown(RESEND_COOLDOWN_SECONDS);
  const { resend, isResending } = useResendOtp({
    phone,
    onSuccess: cooldown.start,
  });

  // Start the cooldown on first paint since /verify lands right after a fresh OTP request.
  useEffect(() => {
    cooldown.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <OtpVerifyFormView
      phone={phone}
      code={code}
      setCode={setCode}
      isSubmitting={isSubmitting || isResending}
      error={error}
      resendIsReady={cooldown.isReady}
      resendRemaining={cooldown.remaining}
      onResend={() => {
        void resend();
      }}
    />
  );
}
