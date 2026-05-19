import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SupportedCurrencySchema, BirElectionSchema } from "@raket/contracts";
import type { useProfileSetup } from "../hooks/use-profile-setup";

type Props = ReturnType<typeof useProfileSetup>;

const CURRENCIES = SupportedCurrencySchema.options;

const BIR_OPTIONS = [
  {
    value: BirElectionSchema.enum["8_percent"],
    label: "8% gross receipts",
    description:
      "Flat tax on all income — simpler to compute. Most common for Filipino freelancers.",
  },
  {
    value: BirElectionSchema.enum.graduated,
    label: "Graduated income tax + 1% percentage tax",
    description: "Tiered rates that may be lower at higher income levels. More complex to file.",
  },
] as const;

export function ProfileSetupWizardView({ form, onSubmit, isSubmitting, watchedName }: Props) {
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-lg space-y-8 py-12">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Set up your profile</h1>
        <p className="mt-1 text-sm text-slate-500">
          This information appears on your invoices and helps us personalise your experience.
        </p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="name" className="text-sm font-medium text-slate-700">
          Full name <span className="text-red-500">*</span>
        </label>
        <Input id="name" {...register("name")} placeholder="e.g. Maria Santos" />
        {errors.name && <p className="text-sm text-red-600">{errors.name.message}</p>}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="businessName" className="text-sm font-medium text-slate-700">
          Business name
        </label>
        <Input
          id="businessName"
          {...register("businessName")}
          placeholder={watchedName ? `${watchedName} Freelance` : "Your business name"}
        />
        <p className="text-xs text-slate-500">
          Shown on invoices. Defaults to &ldquo;{watchedName || "Your name"} Freelance&rdquo; if
          left blank.
        </p>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-700">Default invoice currency</legend>
        <div className="flex flex-wrap gap-4">
          {CURRENCIES.map((cur) => (
            <label key={cur} className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                value={cur}
                {...register("defaultCurrency")}
                className="accent-emerald-600"
              />
              <span className="text-sm font-medium">{cur}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <label htmlFor="hourlyAmount" className="text-sm font-medium text-slate-700">
          Default hourly rate
        </label>
        <div className="flex gap-2">
          <Input
            id="hourlyAmount"
            type="number"
            min={0}
            step={0.01}
            {...register("defaultHourlyRate.amount", { valueAsNumber: true })}
            className="w-32"
            placeholder="0"
          />
          <select
            {...register("defaultHourlyRate.currency")}
            className="rounded-md border border-slate-300 px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {CURRENCIES.map((cur) => (
              <option key={cur} value={cur}>
                {cur}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-slate-500">
          Optional. Used when creating time-based line items.
        </p>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-700">BIR income tax election</legend>
        <div className="space-y-3">
          {BIR_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-4 transition-colors hover:border-emerald-400 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50"
            >
              <input
                type="radio"
                value={opt.value}
                {...register("bir2303Election")}
                className="mt-0.5 accent-emerald-600"
              />
              <div>
                <p className="text-sm font-medium text-slate-900">{opt.label}</p>
                <p className="mt-0.5 text-xs text-slate-500">{opt.description}</p>
              </div>
            </label>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          Not sure which to choose?{" "}
          <a
            href="https://www.bir.gov.ph"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-700 underline"
          >
            bir.gov.ph
          </a>{" "}
          has the official guidance.
        </p>
      </fieldset>

      <Button type="submit" isLoading={isSubmitting} className="w-full" size="lg">
        Save and continue
      </Button>
    </form>
  );
}
