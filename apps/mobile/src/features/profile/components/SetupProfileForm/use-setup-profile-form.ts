import { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useUpdateProfile } from "../../hooks/use-update-profile";
import {
  SetupProfileFormSchema,
  buildSetupProfileDefaults,
  toUpdateProfileBody,
  type SetupProfileFormValues,
} from "../../utils/form-values";
import { clearDraft, loadDraft, saveDraft } from "../../utils/draft-storage";
import { submitSetupProfile } from "./submit";

const AUTOSAVE_DEBOUNCE_MS = 200;

export function useSetupProfileForm() {
  const router = useRouter();
  const update = useUpdateProfile();
  const [isDraftHydrated, setIsDraftHydrated] = useState(false);

  const form = useForm<SetupProfileFormValues>({
    resolver: zodResolver(SetupProfileFormSchema),
    defaultValues: buildSetupProfileDefaults(null),
    mode: "onSubmit",
  });

  useEffect(() => {
    let active = true;
    loadDraft().then((draft) => {
      if (!active) return;
      if (draft) form.reset(buildSetupProfileDefaults(draft));
      setIsDraftHydrated(true);
    });
    return () => {
      active = false;
    };
    // form.reset is stable across renders; we only want this on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const subscription = form.watch((values) => {
      if (!isDraftHydrated) return;
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        void saveDraft(toUpdateProfileBody(values as SetupProfileFormValues));
      }, AUTOSAVE_DEBOUNCE_MS);
    });
    return () => {
      subscription.unsubscribe();
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [form, isDraftHydrated]);

  useEffect(() => {
    const subscription = form.watch((values, info) => {
      if (info.name !== "defaultCurrency") return;
      const next = values.defaultCurrency;
      if (!next) return;
      const rate = form.getValues("defaultHourlyRate");
      if (rate?.currency === next) return;
      form.setValue(
        "defaultHourlyRate",
        { amount: rate?.amount, currency: next },
        { shouldDirty: true, shouldValidate: false },
      );
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await submitSetupProfile({
      values,
      save: (body) => update.save(body),
      navigate: () => router.replace("/"),
    });
    if (result.ok) {
      await clearDraft();
    }
  });

  return {
    form,
    onSubmit,
    isSubmitting: update.isSaving,
    submitError: update.error,
  };
}
