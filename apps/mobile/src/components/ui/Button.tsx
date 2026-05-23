import { Pressable, Text, ActivityIndicator, View, type PressableProps } from "react-native";
import { forwardRef, type ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const button = cva("flex-row items-center justify-center gap-2 rounded-xl", {
  variants: {
    variant: {
      primary: "bg-brand-600 active:bg-brand-700",
      secondary: "bg-gray-100 active:bg-gray-200",
      ghost: "bg-transparent active:bg-gray-100",
      outline: "border border-brand-600 bg-transparent active:bg-brand-50",
      destructive: "bg-red-500 active:bg-red-600",
    },
    size: { xs: "h-8 px-3", sm: "h-9 px-3", md: "h-12 px-4", lg: "h-14 px-6" },
    fullWidth: { true: "w-full", false: "" },
  },
  defaultVariants: { variant: "primary", size: "md", fullWidth: false },
});

const label = cva("font-semibold", {
  variants: {
    variant: {
      primary: "text-white",
      secondary: "text-gray-800",
      ghost: "text-brand-600",
      outline: "text-brand-600",
      destructive: "text-white",
    },
    size: { xs: "text-xs", sm: "text-sm", md: "text-base", lg: "text-lg" },
  },
  defaultVariants: { variant: "primary", size: "md" },
});

type Props = PressableProps &
  VariantProps<typeof button> & {
    isLoading?: boolean;
    leftIcon?: ReactNode;
    rightIcon?: ReactNode;
    children: ReactNode;
  };

export const Button = forwardRef<View, Props>(
  (
    {
      className,
      variant,
      size,
      fullWidth,
      isLoading,
      disabled,
      leftIcon,
      rightIcon,
      children,
      ...rest
    },
    ref,
  ) => (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled ?? false, busy: isLoading ?? false }}
      className={cn(
        button({ variant, size, fullWidth }),
        (disabled || isLoading) && "opacity-50",
        className,
      )}
      disabled={disabled || isLoading}
      {...rest}
    >
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={variant === "primary" || variant === "destructive" ? "white" : "#059669"}
        />
      ) : (
        <>
          {leftIcon ? <View>{leftIcon}</View> : null}
          <Text className={label({ variant, size })}>{children}</Text>
          {rightIcon ? <View>{rightIcon}</View> : null}
        </>
      )}
    </Pressable>
  ),
);
Button.displayName = "Button";
