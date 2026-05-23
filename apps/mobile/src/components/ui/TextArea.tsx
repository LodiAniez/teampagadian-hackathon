import { View, Text, TextInput, type TextInputProps, type ViewProps } from "react-native";
import { forwardRef, useState } from "react";
import { cn } from "@/lib/cn";

export type TextAreaProps = TextInputProps & {
  label?: string;
  hint?: string;
  /** Pass `errors.<name>?.message` from react-hook-form here. */
  error?: string;
  rows?: number;
  containerClassName?: ViewProps["className"];
};

/**
 * Multiline text input wired for react-hook-form + zod.
 *
 * Usage with Controller:
 *   <Controller
 *     control={control}
 *     name="notes"
 *     render={({ field }) => (
 *       <TextArea
 *         label="Notes"
 *         value={field.value}
 *         onChangeText={field.onChange}
 *         onBlur={field.onBlur}
 *         error={errors.notes?.message}
 *       />
 *     )}
 *   />
 */
export const TextArea = forwardRef<TextInput, TextAreaProps>(
  (
    {
      label,
      hint,
      error,
      rows = 4,
      className,
      containerClassName,
      onFocus,
      onBlur,
      editable = true,
      ...rest
    },
    ref,
  ) => {
    const [focused, setFocused] = useState(false);
    const minHeight = rows * 24;

    return (
      <View className={cn("gap-1", containerClassName)}>
        {label ? (
          <Text className={cn("text-sm font-medium", focused ? "text-brand-600" : "text-gray-700")}>
            {label}
          </Text>
        ) : null}

        <TextInput
          ref={ref}
          multiline
          textAlignVertical="top"
          style={{ minHeight }}
          className={cn(
            "rounded-xl border bg-white px-4 py-3 text-base text-gray-900",
            !editable && "bg-gray-50 opacity-60",
            error ? "border-red-400" : focused ? "border-brand-500" : "border-gray-200",
            className,
          )}
          placeholderTextColor="#9ca3af"
          editable={editable}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />

        {error ? (
          <Text className="text-xs text-red-500">{error}</Text>
        ) : hint ? (
          <Text className="text-xs text-gray-400">{hint}</Text>
        ) : null}
      </View>
    );
  },
);
TextArea.displayName = "TextArea";
