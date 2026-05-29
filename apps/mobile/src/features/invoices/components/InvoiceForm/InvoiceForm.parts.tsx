import { Fragment } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Controller, type Control } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { cn } from "@/lib/cn";
import { formatBytes, formatMoney } from "@/lib/format";
import { parseNumber } from "@/lib/parse-number";
import type { CreateInvoiceLineItem } from "@raket/contracts";
import {
  computeInvoiceTotal,
  computeLineTotal,
  type InvoiceFormValues,
} from "../../utils/form-values";
import type { UploadPanelMessage, UploadSelectedFile } from "../../types";
import type { ReviewEditCardRow } from "./use-review-edit-card";

export function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="mb-2 mt-4 text-xs font-bold uppercase tracking-wider text-gray-500">
      {children}
    </Text>
  );
}

type TextPanelProps = {
  value: string;
  onChange: (next: string) => void;
  onGenerate: () => void;
  isParsing: boolean;
  error?: { message?: string } | null;
};

export function TextPanel({ value, onChange, onGenerate, isParsing, error }: TextPanelProps) {
  return (
    <View className="gap-2">
      <View>
        <TextArea
          value={value}
          onChangeText={onChange}
          placeholder="20 hours of UI design for Northwind at $80/hr, due in 14 days"
          rows={4}
          editable={!isParsing}
          accessibilityLabel="Describe the work you did"
        />
        <View className="mt-2 flex-row justify-end">
          <Button
            variant="primary"
            size="sm"
            onPress={onGenerate}
            isLoading={isParsing}
            disabled={isParsing || value.trim().length === 0}
            accessibilityLabel="Generate invoice from text"
          >
            {isParsing ? "Generating…" : "✨  Generate"}
          </Button>
        </View>
      </View>
      <Text className="text-xs text-gray-500">
        Gemini pulls client, line items, amounts, and dates. You review before sending.
      </Text>
      {error ? (
        <Text className="text-xs text-red-500">
          Couldn't parse that — {error.message ?? "try a clearer description."}
        </Text>
      ) : null}
    </View>
  );
}

type UploadPanelProps = {
  selectedFile: UploadSelectedFile | null;
  message: UploadPanelMessage;
  isParsing: boolean;
  onPickDocument: () => void;
  onPickImage: () => void;
};

export function UploadPanel({
  selectedFile,
  message,
  isParsing,
  onPickDocument,
  onPickImage,
}: UploadPanelProps) {
  return (
    <View className="gap-2">
      {selectedFile ? (
        <View className="gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3">
          <View className="flex-row items-center gap-3">
            <Text className="text-2xl">📄</Text>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-gray-800" numberOfLines={1}>
                {selectedFile.name}
              </Text>
              <Text className="text-xs text-gray-500">{formatBytes(selectedFile.size)}</Text>
            </View>
          </View>
          <View className="flex-row gap-2">
            <Pressable
              onPress={onPickImage}
              disabled={isParsing}
              accessibilityRole="button"
              accessibilityLabel="Replace with an image from your gallery"
              className="flex-1 items-center rounded-lg bg-gray-100 py-2"
            >
              <Text className="text-xs font-semibold text-gray-700">Replace · Gallery</Text>
            </Pressable>
            <Pressable
              onPress={onPickDocument}
              disabled={isParsing}
              accessibilityRole="button"
              accessibilityLabel="Replace with a file from device storage"
              className="flex-1 items-center rounded-lg bg-gray-100 py-2"
            >
              <Text className="text-xs font-semibold text-gray-700">Replace · Files</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View className="gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-white p-4">
          <Text className="text-center text-sm font-semibold text-gray-700">Upload a quote</Text>
          <View className="flex-row gap-2">
            <UploadSourceButton
              icon="🖼"
              title="From gallery"
              subtitle="PNG, JPG"
              onPress={onPickImage}
              disabled={isParsing}
            />
            <UploadSourceButton
              icon="📄"
              title="From files"
              subtitle="PDF"
              onPress={onPickDocument}
              disabled={isParsing}
            />
          </View>
        </View>
      )}

      <Text className="text-xs text-gray-500">
        Gemini reads your quote and pulls client, line items, amounts, and dates. You review before
        sending.
      </Text>

      <UploadPanelMessageView message={message} />
    </View>
  );
}

function UploadSourceButton({
  icon,
  title,
  subtitle,
  onPress,
  disabled,
}: {
  icon: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      className="flex-1 items-center rounded-lg bg-gray-100 py-4"
    >
      <Text className="text-2xl">{icon}</Text>
      <Text className="mt-1 text-xs font-semibold text-gray-800">{title}</Text>
      <Text className="text-[10px] text-gray-500">{subtitle}</Text>
    </Pressable>
  );
}

function UploadPanelMessageView({ message }: { message: UploadPanelMessage }) {
  if (!message) return null;
  if (message.kind === "emptyDraft") {
    return (
      <View className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
        <Text className="text-xs text-amber-900">{message.text}</Text>
      </View>
    );
  }
  // pickError and serverError share the same red treatment — both are
  // "this attempt didn't work" from the user's perspective.
  return (
    <View className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
      <Text className="text-xs text-red-700">{message.text}</Text>
    </View>
  );
}

export function ManualPanelStub() {
  return (
    <View className="rounded-xl border border-dashed border-gray-300 bg-white p-4">
      <Text className="text-sm font-semibold text-gray-700">Manual entry</Text>
      <Text className="mt-1 text-xs text-gray-500">
        Skip the AI and fill out the form below directly. Wiring lands in a follow-up.
      </Text>
    </View>
  );
}

export function WarningsChips({ warnings }: { warnings: ReadonlyArray<string> }) {
  if (warnings.length === 0) return null;
  return (
    <View className="gap-2">
      {warnings.map((warning) => (
        <View
          key={warning}
          className="flex-row items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2"
        >
          <Text className="text-amber-700">⚠</Text>
          <Text className="flex-1 text-xs text-amber-900">{warning}</Text>
        </View>
      ))}
    </View>
  );
}

type AIPreviewCardProps = {
  values: Partial<InvoiceFormValues>;
};

export function AIPreviewCard({ values }: AIPreviewCardProps) {
  const lineItems = values.lineItems ?? [];
  const total = computeInvoiceTotal(lineItems as CreateInvoiceLineItem[]);
  const currency = values.currency ?? "USD";
  const clientName = values.clientName?.trim() || "—";
  const clientEmail = values.clientEmail?.trim() || "Email not detected";

  return (
    <View className="rounded-2xl border border-brand-100 bg-brand-50 p-4">
      <View className="mb-2 flex-row">
        <View className="rounded-full bg-brand-600 px-3 py-1">
          <Text className="text-[10px] font-bold uppercase tracking-wider text-white">
            ✨ Parsed by Gemini
          </Text>
        </View>
      </View>

      <Text className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
        Bill to
      </Text>
      <Text className="mt-0.5 text-base font-bold text-gray-900">{clientName}</Text>
      <Text className="mt-0.5 text-xs text-gray-500">{clientEmail}</Text>

      <View className="mt-3 flex-row gap-2">
        <PreviewMeta label="Issue date" value={values.issueDate ?? "—"} />
        <PreviewMeta label="Due date" value={values.dueDate ?? "—"} />
      </View>

      <View className="mt-3 gap-0">
        {lineItems.length === 0 ? (
          <Text className="py-2 text-xs text-gray-500">No line items yet.</Text>
        ) : (
          lineItems.map((item, idx) => (
            <Fragment key={`${item.description}-${idx}`}>
              <View
                className={cn(
                  "flex-row items-center gap-2 py-2",
                  idx > 0 && "border-t border-dashed border-gray-200",
                )}
              >
                <Text className="flex-1 text-sm text-gray-800">
                  {item.description?.trim() || "Untitled line"}
                </Text>
                <Text className="text-xs text-gray-500">
                  {item.quantity} {item.unit || ""} × {formatMoney(item.rate, currency)}
                </Text>
                <Text className="text-sm font-semibold text-gray-900">
                  {formatMoney(computeLineTotal(item), currency)}
                </Text>
              </View>
            </Fragment>
          ))
        )}
      </View>

      <View className="mt-3 flex-row items-baseline justify-between border-t border-gray-200 pt-3">
        <Text className="text-xs text-gray-500">Total</Text>
        <Text className="text-2xl font-bold text-gray-900">{formatMoney(total, currency)}</Text>
      </View>
    </View>
  );
}

function PreviewMeta({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2">
      <Text className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </Text>
      <Text className="mt-0.5 text-sm font-semibold text-gray-900">{value}</Text>
    </View>
  );
}

type ReviewEditCardProps = {
  control: Control<InvoiceFormValues>;
  rows: ReadonlyArray<ReviewEditCardRow>;
  onAdd: () => void;
};

export function ReviewEditCard({ control, rows, onAdd }: ReviewEditCardProps) {
  return (
    <Card className="gap-4">
      <Controller
        control={control}
        name="clientEmail"
        render={({ field, fieldState }) => (
          <TextField
            label="Bill-to email"
            value={field.value ?? ""}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            placeholder="client@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            error={fieldState.error?.message}
          />
        )}
      />

      <View className="gap-3">
        {rows.map((row) => (
          <LineItemRow key={row.id} control={control} row={row} />
        ))}
      </View>

      <Pressable
        onPress={onAdd}
        accessibilityRole="button"
        className="flex-row items-center justify-center gap-2 rounded-xl bg-brand-50 py-3"
      >
        <Text className="text-base font-semibold text-brand-700">＋ Add another line item</Text>
      </Pressable>
    </Card>
  );
}

type LineItemRowProps = {
  control: Control<InvoiceFormValues>;
  row: ReviewEditCardRow;
};

function LineItemRow({ control, row }: LineItemRowProps) {
  const { index, canRemove, onRemove } = row;
  return (
    <View className="gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
      <View className="flex-row items-center gap-2">
        <View className="flex-1">
          <Controller
            control={control}
            name={`lineItems.${index}.description`}
            render={({ field, fieldState }) => (
              <TextField
                label={index === 0 ? "Description" : `Line ${index + 1}`}
                value={field.value ?? ""}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
              />
            )}
          />
        </View>
        {canRemove ? (
          <Pressable
            onPress={onRemove}
            accessibilityLabel={`Remove line item ${index + 1}`}
            className="mt-5 h-8 w-8 items-center justify-center rounded-full bg-gray-200"
          >
            <Text className="text-base text-gray-600">✕</Text>
          </Pressable>
        ) : null}
      </View>
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Controller
            control={control}
            name={`lineItems.${index}.quantity`}
            render={({ field, fieldState }) => (
              <TextField
                label="Qty"
                value={String(field.value ?? "")}
                onChangeText={(text) => field.onChange(parseNumber(text))}
                onBlur={field.onBlur}
                keyboardType="decimal-pad"
                error={fieldState.error?.message}
              />
            )}
          />
        </View>
        <View className="flex-1">
          <Controller
            control={control}
            name={`lineItems.${index}.unit`}
            render={({ field, fieldState }) => (
              <TextField
                label="Unit"
                value={field.value ?? ""}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
              />
            )}
          />
        </View>
        <View className="flex-1">
          <Controller
            control={control}
            name={`lineItems.${index}.rate`}
            render={({ field, fieldState }) => (
              <TextField
                label="Rate"
                value={String(field.value ?? "")}
                onChangeText={(text) => field.onChange(parseNumber(text))}
                onBlur={field.onBlur}
                keyboardType="decimal-pad"
                error={fieldState.error?.message}
              />
            )}
          />
        </View>
      </View>
    </View>
  );
}

type StickyActionsProps = {
  onSaveDraft: () => void;
  onContinueToSend: () => void;
  isSubmitting: boolean;
  disabled: boolean;
};

export function StickyActions({
  onSaveDraft,
  onContinueToSend,
  isSubmitting,
  disabled,
}: StickyActionsProps) {
  return (
    <View className="flex-row gap-2 border-t border-gray-200 bg-white/95 px-4 py-3">
      <View className="flex-1">
        <Button
          variant="secondary"
          fullWidth
          onPress={onSaveDraft}
          isLoading={isSubmitting}
          disabled={disabled || isSubmitting}
        >
          Save draft
        </Button>
      </View>
      <View className="flex-1">
        <Button
          variant="primary"
          fullWidth
          onPress={onContinueToSend}
          isLoading={isSubmitting}
          disabled={disabled || isSubmitting}
        >
          Continue to send
        </Button>
      </View>
    </View>
  );
}

export function SubmitErrorBanner({ error }: { error: { message?: string } | null }) {
  if (!error) return null;
  return (
    <View className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
      <Text className="text-xs text-red-700">
        Couldn't save invoice — {error.message ?? "please try again."}
      </Text>
    </View>
  );
}

export function ParseLoadingState({ text }: { text: string }) {
  return (
    <View className="flex-row items-center gap-2 rounded-xl border border-brand-100 bg-brand-50 px-3 py-3">
      <ActivityIndicator color="#0d9488" />
      <Text className="text-sm text-brand-700">{text}</Text>
    </View>
  );
}
