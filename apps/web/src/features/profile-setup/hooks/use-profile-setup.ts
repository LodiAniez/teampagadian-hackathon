"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { BirElectionSchema, SupportedCurrencySchema } from "@raket/contracts";
import { api } from "@/lib/api-client";
import { authHeader } from "@/lib/auth";

const DRAFT_KEY = "raket:setup-profile:draft";

const ProfileSetupFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  businessName: z.string().max(120),
  defaultCurrency: SupportedCurrencySchema,
  defaultHourlyRate: z.object({
    amount: z.number().nonnegative(),
    currency: SupportedCurrencySchema,
  }),
  bir2303Election: BirElectionSchema,
});

type ProfileSetupForm = z.infer<typeof ProfileSetupFormSchema>;

function loadDraft(): Partial<ProfileSetupForm> {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function useProfileSetup() {
  const router = useRouter();
  const draft = useMemo(() => loadDraft(), []);

  const form = useForm<ProfileSetupForm>({
    resolver: zodResolver(ProfileSetupFormSchema),
    defaultValues: {
      name: draft.name ?? "",
      businessName: draft.businessName ?? "",
      defaultCurrency: draft.defaultCurrency ?? SupportedCurrencySchema.enum.USD,
      defaultHourlyRate: draft.defaultHourlyRate ?? {
        amount: 0,
        currency: SupportedCurrencySchema.enum.USD,
      },
      bir2303Election: draft.bir2303Election ?? BirElectionSchema.enum["8_percent"],
    },
  });

  const [watchedName, setWatchedName] = useState(() => form.getValues("name"));

  useEffect(() => {
    const subscription = form.watch((values) => {
      setWatchedName(values.name ?? "");
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(values));
      } catch {}
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const { mutateAsync, isPending: isSubmitting } = useMutation({
    mutationFn: async (values: ProfileSetupForm) => {
      const businessName = values.businessName.trim() || `${values.name} Freelance`;
      const result = await api.auth.updateProfile({
        headers: await authHeader(),
        body: {
          name: values.name,
          businessName,
          defaultCurrency: values.defaultCurrency,
          ...(values.defaultHourlyRate.amount > 0 && {
            defaultHourlyRate: values.defaultHourlyRate,
          }),
          bir2303Election: values.bir2303Election,
        },
      });
      if (result.status !== 200) throw new Error("Profile update failed");
      return result.body;
    },
    onSuccess: () => {
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {}
      router.push("/dashboard");
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    await mutateAsync(values);
  });

  return { form, onSubmit, isSubmitting, watchedName };
}
