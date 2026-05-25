import { Text, View } from "react-native";
import { Controller } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TextField } from "@/components/ui/TextField";
import { parseNumber } from "@/features/invoices/utils/parse-number";
import { useSetupProfileForm } from "./use-setup-profile-form";
import {
  BIR_OPTIONS,
  BirElectionPicker,
  CURRENCY_OPTIONS,
  SectionLabel,
} from "./SetupProfileForm.parts";

type SetupProfileFormProps = {
  onOpenBirInfo: () => void;
};

export function SetupProfileForm({ onOpenBirInfo }: SetupProfileFormProps) {
  const f = useSetupProfileForm();
  const {
    control,
    formState: { errors },
  } = f.form;

  return (
    <View className="gap-4">
      <View className="gap-1">
        <Text className="text-3xl font-bold text-gray-900">Set up your profile</Text>
        <Text className="text-sm text-gray-500">
          Just a few details so Raket can fill out your invoices.
        </Text>
      </View>

      <Controller
        control={control}
        name="name"
        render={({ field }) => (
          <TextField
            label="Full name"
            placeholder="Ada Lovelace"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            autoCapitalize="words"
            error={errors.name?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="businessName"
        render={({ field }) => (
          <TextField
            label="Business name"
            placeholder="Defaults to '<your name> Freelance'"
            value={field.value ?? ""}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.businessName?.message}
            hint="Shown on invoices as the sender."
          />
        )}
      />

      <View>
        <SectionLabel>Default invoice currency</SectionLabel>
        <Controller
          control={control}
          name="defaultCurrency"
          render={({ field }) => (
            <SegmentedControl
              options={CURRENCY_OPTIONS}
              value={field.value || "USD"}
              onChange={(next) => {
                field.onChange(next);
                const rate = f.form.getValues("defaultHourlyRate");
                f.form.setValue(
                  "defaultHourlyRate",
                  { amount: rate?.amount, currency: next },
                  { shouldDirty: true, shouldValidate: false },
                );
              }}
            />
          )}
        />
      </View>

      <Controller
        control={control}
        name="defaultHourlyRate.amount"
        render={({ field, fieldState }) => (
          <TextField
            label="Default hourly rate"
            placeholder="80"
            value={field.value === undefined ? "" : String(field.value)}
            onChangeText={(text) => {
              const parsed = parseNumber(text);
              field.onChange(parsed === 0 && text.trim() === "" ? undefined : parsed);
            }}
            onBlur={field.onBlur}
            keyboardType="decimal-pad"
            error={fieldState.error?.message}
            hint="Used as the default rate when you create an invoice."
          />
        )}
      />

      <View>
        <SectionLabel>BIR 2303 election</SectionLabel>
        <Controller
          control={control}
          name="bir2303Election"
          render={({ field }) => (
            <BirElectionPicker
              value={field.value ?? BIR_OPTIONS[0].value}
              onChange={field.onChange}
              onOpenBirInfo={onOpenBirInfo}
            />
          )}
        />
      </View>

      {f.submitError ? (
        <View className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
          <Text className="text-xs text-red-700">
            Couldn't save your profile — {f.submitError.message ?? "please try again."}
          </Text>
        </View>
      ) : null}

      <Button onPress={f.onSubmit} isLoading={f.isSubmitting} size="lg" fullWidth>
        Save and continue
      </Button>

      <View className="h-8" />
    </View>
  );
}
