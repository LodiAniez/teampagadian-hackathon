"use client";

import { Toaster as SonnerToaster, type ToasterProps } from "sonner";

export function Toaster(props: ToasterProps) {
  return (
    <SonnerToaster
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "rounded-md border border-slate-200 bg-white text-slate-900 shadow-sm",
          description: "text-slate-500",
        },
      }}
      {...props}
    />
  );
}
