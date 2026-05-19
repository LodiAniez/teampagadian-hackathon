"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "../api/auth.api";
import { setAccessToken } from "@/lib/auth";

type UseOtpVerifyOptions = { phone: string };

const OTP_LENGTH = 6;

export function useOtpVerify({ phone }: UseOtpVerifyOptions) {
  const router = useRouter();
  const [code, setCodeRaw] = useState("");
  const [error, setError] = useState<string | null>(null);

  const verify = useMutation({
    mutationFn: async (submittedCode: string) => {
      const result = await api.auth.verifyOtp({ body: { phone, code: submittedCode } });
      if (result.status === 401) {
        const message = result.body?.message ?? "Invalid code";
        throw new InvalidCodeError(message);
      }
      if (result.status !== 200) {
        throw new Error(`Verification failed (status ${result.status})`);
      }
      return result.body;
    },
    onSuccess: (body) => {
      setAccessToken(body.accessToken);
      router.push(body.isNewUser ? "/setup-profile" : "/dashboard");
    },
    onError: (err) => {
      setCodeRaw("");
      setError(err instanceof Error ? err.message : "Verification failed");
    },
  });

  function setCode(next: string) {
    const digitsOnly = next.replace(/\D/g, "").slice(0, OTP_LENGTH);
    setCodeRaw(digitsOnly);
    if (error) setError(null);
  }

  useEffect(() => {
    if (code.length === OTP_LENGTH && !verify.isPending) {
      verify.mutate(code);
    }
    // verify.mutate is stable across renders; intentionally omitted from deps to
    // avoid an extra firing when react-query updates internal state mid-mutation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return {
    code,
    setCode,
    isSubmitting: verify.isPending,
    error,
  };
}

class InvalidCodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidCodeError";
  }
}
