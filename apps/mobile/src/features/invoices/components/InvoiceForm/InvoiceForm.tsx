import { View } from "react-native";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useInvoiceForm, type InvoiceMode } from "./use-invoice-form";
import {
  AIPreviewCard,
  ManualPanelStub,
  ParseLoadingState,
  ReviewEditCard,
  SectionLabel,
  StickyActions,
  SubmitErrorBanner,
  TextPanel,
  UploadPanelStub,
  WarningsChips,
} from "./InvoiceForm.parts";

const MODE_OPTIONS: ReadonlyArray<{ value: InvoiceMode; label: string }> = [
  { value: "text", label: "Text" },
  { value: "upload", label: "Upload" },
  { value: "manual", label: "Manual" },
];

export function InvoiceForm() {
  const f = useInvoiceForm();
  const watched = f.form.watch();
  const showAIPreview = f.mode !== "manual" && f.hasDraft;
  const showReviewForm = f.hasDraft;

  return (
    <View className="flex-1">
      <View className="gap-3 px-4 pt-2">
        <SegmentedControl options={MODE_OPTIONS} value={f.mode} onChange={f.onModeChange} />

        <SectionLabel>What did you do?</SectionLabel>

        {f.mode === "text" ? (
          <TextPanel
            value={f.draftText}
            onChange={f.setDraftText}
            onGenerate={f.onGenerate}
            isParsing={f.isParsing}
            error={f.parseError}
          />
        ) : null}
        {f.mode === "upload" ? <UploadPanelStub /> : null}
        {f.mode === "manual" ? <ManualPanelStub /> : null}

        {f.isParsing ? <ParseLoadingState /> : null}

        <WarningsChips warnings={f.warnings} />

        {showAIPreview ? (
          <>
            <SectionLabel>Raket AI · preview</SectionLabel>
            <AIPreviewCard values={watched} />
          </>
        ) : null}

        {showReviewForm ? (
          <>
            <SectionLabel>Review &amp; edit</SectionLabel>
            <ReviewEditCard
              form={f.form}
              lineItemFields={f.lineItems.fields}
              onAdd={f.addLineItem}
              onRemove={f.removeLineItem}
            />
          </>
        ) : null}

        <SubmitErrorBanner error={f.submitError} />
      </View>

      <View className="h-24" />

      <View className="absolute bottom-0 left-0 right-0">
        <StickyActions
          onSaveDraft={f.onSaveDraft}
          onContinueToSend={f.onContinueToSend}
          isSubmitting={f.isSubmitting}
          disabled={!f.hasDraft}
        />
      </View>
    </View>
  );
}
