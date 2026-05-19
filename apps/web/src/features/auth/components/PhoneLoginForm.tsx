"use client";

import { usePhoneLogin } from "../hooks/use-phone-login";
import { PhoneLoginFormView } from "./PhoneLoginFormView";

export function PhoneLoginForm() {
  const { form, onSubmit, isSubmitting, canSubmit, countryCode } = usePhoneLogin();
  return (
    <PhoneLoginFormView
      form={form}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
      canSubmit={canSubmit}
      countryCode={countryCode}
    />
  );
}
