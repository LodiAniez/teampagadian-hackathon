import { useState } from "react";
import { Platform } from "react-native";
import { useRouter } from "expo-router";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import {
  CreateInvoiceBodySchema,
  QUOTATION_MIME_TYPES,
  type CreateInvoiceBody,
  type ParsedInvoiceDraft,
} from "@raket/contracts";
import { useParseInvoiceText } from "../../hooks/use-parse-invoice-text";
import { useParseQuotation } from "../../hooks/use-parse-quotation";
import { useCreateInvoice } from "../../hooks/use-create-invoice";
import type { InvoiceMode, UploadPanelMessage, UploadSelectedFile } from "../../types";
import {
  emptyFormValues,
  mapDraftToFormValues,
  type InvoiceFormValues,
} from "../../utils/form-values";
import {
  messageForUploadError,
  validatePickedAsset,
  type PickedAsset,
} from "../../utils/upload-validation";

export function useInvoiceForm() {
  const router = useRouter();
  const parse = useParseInvoiceText();
  const parseQuotation = useParseQuotation();
  const create = useCreateInvoice();

  const [mode, setMode] = useState<InvoiceMode>("text");
  const [draftText, setDraftText] = useState("");
  const [hasDraft, setHasDraft] = useState(false);
  const [selectedFile, setSelectedFile] = useState<UploadSelectedFile | null>(null);
  const [uploadPanelMessage, setUploadPanelMessage] = useState<UploadPanelMessage>(null);

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

  async function onPickFile(asset: PickedAsset) {
    const validation = validatePickedAsset(asset);
    if (!validation.ok) {
      setSelectedFile(null);
      setUploadPanelMessage({ kind: "pickError", text: validation.error });
      return;
    }
    setSelectedFile(validation.file);
    setUploadPanelMessage(null);

    try {
      const draft = await parseQuotation.upload({ file: validation.file });
      if (draft.lineItems.length === 0) {
        // Server saw the file but extracted no work rows — keep the picked
        // file visible so the user can replace it, don't bounce them into an
        // empty review form.
        setUploadPanelMessage({
          kind: "emptyDraft",
          text: "Couldn't extract invoice data — try a different file, or switch to manual entry",
        });
        return;
      }
      applyDraft(draft, "upload");
    } catch (err) {
      setUploadPanelMessage({ kind: "serverError", text: messageForUploadError(err) });
    }
  }

  async function onPickDocument() {
    // iOS honours `type` strictly, so we pass the precise MIME list. Android's
    // Storage Access Framework hides files whose MIME entry doesn't *exactly*
    // match — files in Downloads often have a generic `application/octet-stream`
    // type and get filtered out, leaving the user with "No items to choose"
    // even when their PDF is right there. We pass `*/*` on Android and let
    // `validatePickedAsset` reject anything that isn't actually PDF/PNG/JPEG.
    const pickerType = Platform.OS === "android" ? ["*/*"] : [...QUOTATION_MIME_TYPES];
    const result = await DocumentPicker.getDocumentAsync({
      type: pickerType,
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || result.assets.length === 0) return;
    await onPickFile(result.assets[0]);
  }

  async function onPickImage() {
    // Gallery picker — covers screenshots/photos of quotes. On Android the
    // system Photo Picker (used here) sidesteps Samsung/Xiaomi's compact
    // Documents UI, which often hides files in Downloads behind a "Recent"-only
    // view with no navigation. PDFs still need onPickDocument.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: false,
      quality: 1,
    });
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0];
    await onPickFile({
      uri: asset.uri,
      // expo-image-picker sometimes returns null fileName on Android when the
      // source isn't in MediaStore. Synthesise a name from the MIME so the
      // server-side multipart handler (which keys on filename) doesn't 400.
      name: asset.fileName ?? `quote.${guessExtension(asset.mimeType)}`,
      mimeType: asset.mimeType,
      size: asset.fileSize,
    });
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
    // Upload mode
    selectedFile,
    uploadPanelMessage,
    isUploading: parseQuotation.isParsing,
    onPickDocument,
    onPickImage,
  };
}

function guessExtension(mimeType: string | undefined): string {
  if (mimeType === "image/png") return "png";
  return "jpg";
}
