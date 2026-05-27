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
import { loadDraft, saveDraft } from "../../utils/draft-storage";
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
    // .catch + .finally are load-bearing: if loadDraft rejects (AsyncStorage
    // disk full / unavailable) the .then never fires, setIsDraftHydrated
    // stays false forever, and the autosave watcher's `if (!isDraftHydrated)
    // return` guard silently drops every keystroke for the session. The user
    // would lose all in-progress data on force-close with no indication. On
    // some RN versions an unhandled rejection also red-screens.
    loadDraft()
      .then((draft) => {
        if (!active) return;
        if (draft) form.reset(buildSetupProfileDefaults(draft));
      })
      .catch(() => {
        // Draft unreadable — start fresh. Autosave will rebuild it.
      })
      .finally(() => {
        if (active) setIsDraftHydrated(true);
      });
    return () => {
      active = false;
    };
    // form.reset is stable across renders; we only want this on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Subscription ORDER MATTERS — RHF fires watch subscribers in registration
  // order. The currency→rate sync MUST register before the autosave so a
  // defaultCurrency change patches defaultHourlyRate.currency BEFORE autosave
  // captures values for persistence. Otherwise a force-close inside the
  // debounce window would persist a draft with mismatched currencies, and on
  // reload the sync (which only fires on user-initiated changes, not
  // form.reset) wouldn't repair it.
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

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const subscription = form.watch((values) => {
      if (!isDraftHydrated) return;
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        void saveDraft(toUpdateProfileBody(values));
      }, AUTOSAVE_DEBOUNCE_MS);
    });
    return () => {
      subscription.unsubscribe();
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [form, isDraftHydrated]);

  const onSubmit = form.handleSubmit(async (values) => {
    await submitSetupProfile({
      values,
      save: (body) => update.save(body),
      navigate: () => router.replace("/"),
    });
    // The mutation's onSuccess (buildUpdateProfileSuccessHandler) owns the
    // draft clear + cache invalidation. Don't double-call here.
  });

  return {
    form,
    onSubmit,
    // formState.isSubmitting stays true for the full handleSubmit async
    // lifetime (save → navigate). update.isSaving covers only the mutation
    // window. ORing both ensures the button never flashes back to idle
    // between the PATCH resolving and the screen transitioning away.
    isSubmitting: form.formState.isSubmitting || update.isSaving,
    submitError: update.error,
  };
}
