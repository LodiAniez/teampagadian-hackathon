import { z } from "zod";
import {
  BirElectionSchema,
  UpdateProfileBodySchema,
  type UpdateProfileDto,
} from "@raket/contracts";

export const SetupProfileFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  businessName: z.string().max(120).optional().default(""),
  defaultCurrency: z.string().optional().default(""),
  defaultHourlyRate: z
    .object({
      amount: z.number().positive().optional(),
      currency: z.string(),
    })
    .default({ amount: undefined, currency: "USD" }),
  bir2303Election: BirElectionSchema,
});

export type SetupProfileFormValues = {
  name: string;
  businessName: string;
  defaultCurrency: string;
  defaultHourlyRate: { amount: number | undefined; currency: string };
  bir2303Election: z.infer<typeof BirElectionSchema>;
};

// What form.watch emits while the form is mounting/resetting or between
// keystrokes — every field can be transiently undefined. toUpdateProfileBody
// accepts this directly so the autosave path doesn't have to cast.
export type SetupProfileFormValuesPartial = {
  name?: string;
  businessName?: string;
  defaultCurrency?: string;
  defaultHourlyRate?: { amount?: number; currency?: string };
  bir2303Election?: SetupProfileFormValues["bir2303Election"];
};

const DEFAULT_CURRENCY = "USD";

export function buildSetupProfileDefaults(draft: UpdateProfileDto | null): SetupProfileFormValues {
  const currency = draft?.defaultCurrency ?? DEFAULT_CURRENCY;
  return {
    name: draft?.name ?? "",
    businessName: draft?.businessName ?? "",
    defaultCurrency: currency,
    defaultHourlyRate: draft?.defaultHourlyRate ?? { amount: undefined, currency },
    bir2303Election: draft?.bir2303Election ?? "8_percent",
  };
}

export function applyBusinessNameAutoFill(values: SetupProfileFormValues): SetupProfileFormValues {
  const trimmedName = values.name.trim();
  const trimmedBusiness = values.businessName.trim();
  if (trimmedBusiness.length > 0) return values;
  if (trimmedName.length === 0) return values;
  return { ...values, businessName: `${trimmedName} Freelance` };
}

export function toUpdateProfileBody(values: SetupProfileFormValuesPartial): UpdateProfileDto {
  // Accepts the partial shape form.watch emits as well as fully-validated
  // submit values. ?? "" guards keep autosave safe during the mount/reset
  // window when fields are transiently undefined.
  const body: UpdateProfileDto = {};
  const name = (values.name ?? "").trim();
  if (name.length > 0) body.name = name;
  const businessName = (values.businessName ?? "").trim();
  if (businessName.length > 0) body.businessName = businessName;
  const defaultCurrency = (values.defaultCurrency ?? "").trim();
  if (defaultCurrency.length > 0) body.defaultCurrency = defaultCurrency;
  const rateAmount = values.defaultHourlyRate?.amount;
  if (typeof rateAmount === "number" && rateAmount > 0) {
    body.defaultHourlyRate = {
      amount: rateAmount,
      currency: values.defaultHourlyRate?.currency ?? (defaultCurrency || "USD"),
    };
  }
  if (values.bir2303Election) body.bir2303Election = values.bir2303Election;
  const parsed = UpdateProfileBodySchema.safeParse(body);
  return parsed.success ? parsed.data : body;
}
