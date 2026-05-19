import type { UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type LoginFormValues = { localNumber: string };

type Props = {
  form: UseFormReturn<LoginFormValues>;
  onSubmit: () => void;
  isSubmitting: boolean;
  canSubmit: boolean;
  countryCode: string;
};

export function PhoneLoginFormView({
  form,
  onSubmit,
  isSubmitting,
  canSubmit,
  countryCode,
}: Props) {
  const error = form.formState.errors.localNumber?.message;
  const value = form.watch("localNumber");

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Sign in to Raket</CardTitle>
        <CardDescription>
          We&apos;ll text you a 6-digit code to confirm it&apos;s you.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <label htmlFor="local-number" className="text-sm font-medium text-slate-900">
              Mobile number
            </label>
            <div className="flex items-stretch">
              <span className="inline-flex h-10 items-center rounded-l-md border border-r-0 border-slate-300 bg-slate-50 px-3 text-sm text-slate-700">
                {countryCode}
              </span>
              <Input
                id="local-number"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="9171234567"
                className="rounded-l-none"
                value={value}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                  form.setValue("localNumber", digits, { shouldValidate: true });
                }}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "local-number-error" : undefined}
              />
            </div>
            {error && (
              <p id="local-number-error" className="text-sm text-red-600">
                {error}
              </p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={!canSubmit} isLoading={isSubmitting}>
            Send code
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
