import { View, Text, TextInput, type TextInputProps, type ViewProps } from "react-native";
import { forwardRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type TextFieldProps = TextInputProps & {
  label?: string;
  hint?: string;
  /** Pass `errors.<name>?.message` from react-hook-form here. */
  error?: string;
  leftElement?: ReactNode;
  rightElement?: ReactNode;
  containerClassName?: ViewProps["className"];
};

/**
 * Controlled text input wired for react-hook-form + zod.
 *
 * Usage with Controller:
 *   <Controller
 *     control={control}
 *     name="email"
 *     render={({ field }) => (
 *       <TextField
 *         label="Email"
 *         value={field.value}
 *         onChangeText={field.onChange}
 *         onBlur={field.onBlur}
 *         error={errors.email?.message}
 *       />
 *     )}
 *   />
 */
export const TextField = forwardRef<TextInput, TextFieldProps>(
  (
    {
      label,
      hint,
      error,
      leftElement,
      rightElement,
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
    const hasLeft = Boolean(leftElement);
    const hasRight = Boolean(rightElement);

    return (
      <View className={cn("gap-1", containerClassName)}>
        {label ? (
          <Text className={cn("text-sm font-medium", focused ? "text-brand-600" : "text-gray-700")}>
            {label}
          </Text>
        ) : null}

        <View
          className={cn(
            "flex-row items-center rounded-xl border bg-white",
            !editable && "bg-gray-50 opacity-60",
            error ? "border-red-400" : focused ? "border-brand-500" : "border-gray-200",
          )}
        >
          {hasLeft ? (
            <View className="items-center justify-center pl-3 pr-1">{leftElement}</View>
          ) : null}

          <TextInput
            ref={ref}
            className={cn(
              "h-12 flex-1 text-base text-gray-900",
              hasLeft ? "pl-1 pr-4" : "px-4",
              hasRight ? "pr-1" : "",
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

          {hasRight ? (
            <View className="items-center justify-center pl-1 pr-3">{rightElement}</View>
          ) : null}
        </View>

        {error ? (
          <Text className="text-xs text-red-500">{error}</Text>
        ) : hint ? (
          <Text className="text-xs text-gray-400">{hint}</Text>
        ) : null}
      </View>
    );
  },
);
TextField.displayName = "TextField";
