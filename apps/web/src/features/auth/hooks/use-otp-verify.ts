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

  const { mutate: submitCode, isPending: isSubmitting } = useMutation({
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
    if (code.length === OTP_LENGTH) {
      submitCode(code);
    }
  }, [code, submitCode]);

  return {
    code,
    setCode,
    isSubmitting,
    error,
  };
}

class InvalidCodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidCodeError";
  }
}
