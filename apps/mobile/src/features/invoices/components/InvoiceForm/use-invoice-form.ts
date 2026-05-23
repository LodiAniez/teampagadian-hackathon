import { useState } from "react";
import { useRouter } from "expo-router";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CreateInvoiceBodySchema,
  type CreateInvoiceBody,
  type ParsedInvoiceDraft,
} from "@raket/contracts";
import { useParseInvoiceText } from "../../hooks/use-parse-invoice-text";
import { useCreateInvoice } from "../../hooks/use-create-invoice";
import {
  emptyFormValues,
  mapDraftToFormValues,
  type InvoiceFormValues,
} from "../../utils/form-values";

export type InvoiceMode = "text" | "upload" | "manual";

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

  function applyDraft(draft: ParsedInvoiceDraft, sourceType: InvoiceMode) {
    form.reset(mapDraftToFormValues(draft, sourceType) as Partial<InvoiceFormValues>);
    setHasDraft(true);
  }

  async function onGenerate() {
    if (!draftText.trim()) return;
    const result = await parse.parse({ text: draftText });
    if (result.status === 200) {
      applyDraft(result.body, mode);
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
    const result = await create.save(values);
    if (result.status !== 201) return;
    if (nextRoute === "send") {
      router.replace({ pathname: "/invoices/[id]/sent", params: { id: result.body.id } });
    } else {
      router.dismissAll();
    }
  }

  const onSaveDraft = form.handleSubmit((values) => saveAndGo(values, "dashboard"));
  const onContinueToSend = form.handleSubmit((values) => saveAndGo(values, "send"));

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
    lineItems,
    addLineItem,
    removeLineItem,
    hasDraft,
    onSaveDraft,
    onContinueToSend,
    isSubmitting: create.isSaving,
    submitError: create.error,
  };
}
