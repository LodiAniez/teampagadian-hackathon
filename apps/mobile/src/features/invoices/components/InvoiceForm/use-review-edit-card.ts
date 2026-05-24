import { useMemo } from "react";
import type { Control, UseFormReturn } from "react-hook-form";
import type { InvoiceFormValues } from "../../utils/form-values";

type Args = {
  form: UseFormReturn<InvoiceFormValues>;
  lineItemFields: ReadonlyArray<{ id: string }>;
  onAdd: () => void;
  onRemove: (index: number) => void;
};

export type ReviewEditCardRow = {
  id: string;
  index: number;
  canRemove: boolean;
  onRemove: () => void;
};

export type UseReviewEditCardResult = {
  control: Control<InvoiceFormValues>;
  rows: ReadonlyArray<ReviewEditCardRow>;
  onAdd: () => void;
};

export function useReviewEditCard({
  form,
  lineItemFields,
  onAdd,
  onRemove,
}: Args): UseReviewEditCardResult {
  const rows = useMemo<ReadonlyArray<ReviewEditCardRow>>(
    () =>
      lineItemFields.map((field, index) => ({
        id: field.id,
        index,
        canRemove: lineItemFields.length > 1,
        onRemove: () => onRemove(index),
      })),
    [lineItemFields, onRemove],
  );

  return { control: form.control, rows, onAdd };
}
