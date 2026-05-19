"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "../api/auth.api";

type UseResendOtpOptions = { phone: string; onSuccess?: () => void };

export function useResendOtp({ phone, onSuccess }: UseResendOtpOptions) {
  const mutation = useMutation({
    mutationFn: async () => {
      const result = await api.auth.requestOtp({ body: { phone } });
      if (result.status !== 200) {
        throw new Error(`Failed to resend code (status ${result.status})`);
      }
      return result.body;
    },
    onSuccess: (body) => {
      if (body.devOtpCode) {
        toast.info(`Demo code: ${body.devOtpCode} (would be sent via SMS)`);
      } else {
        toast.success("New code sent");
      }
      onSuccess?.();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to resend code");
    },
  });

  return {
    resend: () => mutation.mutateAsync(),
    isResending: mutation.isPending,
  };
}
