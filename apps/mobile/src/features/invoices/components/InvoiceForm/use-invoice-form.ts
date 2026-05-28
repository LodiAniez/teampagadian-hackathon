import { useState } from "react";
import { useRouter } from "expo-router";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CreateInvoiceBodySchema,
  type CreateInvoiceBody,
  type ParsedInvoiceDraft,
} from "@raket/contracts";
import { useParseInvoiceText } from "../../hooks/use-parse-invoice-text";
import { useCreateInvoice } from "../../hooks/use-create-invoice";
import type { InvoiceMode } from "../../types";
import {
  emptyFormValues,
  mapDraftToFormValues,
  type InvoiceFormValues,
} from "../../utils/form-values";

export function useInvoiceForm() {
  const router = useRouter();
  const parse = useParseInvoiceText();
  const create = useCreateInvoice();

  const [mode, setMode] = useState<InvoiceMode>("text");
  const [draftText, setDraftText] = useState("");
  const [hasDraft, setHasDraft] = useState(false);

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(CreateInvoiceBodySchema),
    defaultValues: emptyFormValues("text") as Partial<InvoiceFormValues>,
    mode: "onSubmit",
  });

  const lineItems = useFieldArray({ control: form.control, name: "lineItems" });
  const watchedValues = useWatch({ control: form.control }) as Partial<InvoiceFormValues>;

  function applyDraft(draft: ParsedInvoiceDraft, sourceType: InvoiceMode) {
    form.reset(mapDraftToFormValues(draft, sourceType) as Partial<InvoiceFormValues>);
    setHasDraft(true);
  }

  async function onGenerate() {
    if (!draftText.trim()) return;
    try {
      const result = await parse.parse({ text: draftText });
      if (result.status === 200) {
        applyDraft(result.body, mode);
      }
    } catch {
      // mutateAsync rejects on 4xx/5xx; surface via parse.error instead of bubbling.
    }
  }

  function onModeChange(next: InvoiceMode) {
    setMode(next);
    form.setValue("sourceType", next);
    if (next === "manual") {
      setHasDraft(true);
    }
  }

  function addLineItem() {
    lineItems.append({ description: "", quantity: 1, unit: "hours", rate: 0 });
  }

  function removeLineItem(index: number) {
    if (lineItems.fields.length <= 1) return;
    lineItems.remove(index);
  }

  async function saveAndGo(values: CreateInvoiceBody, nextRoute: "send" | "dashboard") {
    try {
      console.log("values", values);

      const result = await create.save(values);
      if (result.status !== 201) return;
      if (nextRoute === "send") {
        router.replace({
          pathname: "/invoices/[id]/sent",
          params: { id: result.body.id, clientEmail: values.clientEmail ?? "" },
        });
      } else {
        router.dismissAll();
      }
    } catch {
      // mutateAsync rejects on 4xx/5xx; surface via create.error instead of bubbling.
    }
  }

  const onSaveDraft = form.handleSubmit((values) => saveAndGo(values, "dashboard"));
  const onContinueToSend = form.handleSubmit((values) => saveAndGo(values, "send"));

  const showAIPreview = mode !== "manual" && hasDraft;
  const showReviewForm = hasDraft;

  return {
    mode,
    onModeChange,
    draftText,
    setDraftText,
    onGenerate,
    isParsing: parse.isParsing,
    parseError: parse.error,
    warnings: parse.warnings,
    form,
    watchedValues,
    lineItems,
    addLineItem,
    removeLineItem,
    hasDraft,
    showAIPreview,
    showReviewForm,
    onSaveDraft,
    onContinueToSend,
    isSubmitting: create.isSaving,
    submitError: create.error,
  };
}
