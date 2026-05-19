"use client";

import { forwardRef, useContext, type ComponentPropsWithoutRef, type ElementRef } from "react";
import { OTPInput, OTPInputContext } from "input-otp";
import { cn } from "@/lib/cn";

export const InputOTP = forwardRef<
  ElementRef<typeof OTPInput>,
  ComponentPropsWithoutRef<typeof OTPInput>
>(({ className, containerClassName, ...rest }, ref) => (
  <OTPInput
    ref={ref}
    containerClassName={cn(
      "flex items-center gap-2 has-[:disabled]:opacity-50",
      containerClassName,
    )}
    className={cn("disabled:cursor-not-allowed", className)}
    {...rest}
  />
));
InputOTP.displayName = "InputOTP";

export const InputOTPGroup = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<"div">>(
  ({ className, ...rest }, ref) => (
    <div ref={ref} className={cn("flex items-center gap-2", className)} {...rest} />
  ),
);
InputOTPGroup.displayName = "InputOTPGroup";

type InputOTPSlotProps = ComponentPropsWithoutRef<"div"> & { index: number };

export const InputOTPSlot = forwardRef<HTMLDivElement, InputOTPSlotProps>(
  ({ index, className, ...rest }, ref) => {
    const ctx = useContext(OTPInputContext);
    const slot = ctx.slots[index];

    return (
      <div
        ref={ref}
        className={cn(
          "relative flex h-12 w-12 items-center justify-center rounded-md border border-slate-300 bg-white text-lg font-medium text-slate-900 shadow-sm transition-all",
          slot?.isActive && "ring-2 ring-brand-500 ring-offset-0 border-brand-500",
          className,
        )}
        {...rest}
      >
        {slot?.char}
        {slot?.hasFakeCaret && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-5 w-px animate-pulse bg-slate-900" />
          </div>
        )}
      </div>
    );
  },
);
InputOTPSlot.displayName = "InputOTPSlot";
