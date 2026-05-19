"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import { api } from "../api/auth.api";

const COUNTRY_CODE = "+63";

const LoginFormSchema = z.object({
  localNumber: z.string().regex(/^\d{10}$/, "Enter a 10-digit Philippine mobile number"),
});

type LoginFormValues = z.infer<typeof LoginFormSchema>;

export function usePhoneLogin() {
  const router = useRouter();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(LoginFormSchema),
    defaultValues: { localNumber: "" },
    mode: "onChange",
  });

  const requestOtp = useMutation({
    mutationFn: async (phone: string) => {
      const result = await api.auth.requestOtp({ body: { phone } });
      if (result.status !== 200) {
        throw new Error(`Failed to request OTP (status ${result.status})`);
      }
      return result.body;
    },
    onSuccess: (body, phone) => {
      if (body.devOtpCode) {
        toast.info(`Demo code: ${body.devOtpCode} (would be sent via SMS)`);
      }
      router.push(`/verify?phone=${encodeURIComponent(phone)}`);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to send code");
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const phone = `${COUNTRY_CODE}${values.localNumber}`;
    await requestOtp.mutateAsync(phone);
  });

  return {
    form,
    onSubmit,
    isSubmitting: requestOtp.isPending,
    countryCode: COUNTRY_CODE,
    canSubmit: form.formState.isValid && !requestOtp.isPending,
  };
}
