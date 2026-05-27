import { Pressable, Text, View } from "react-native";
import { cn } from "@/lib/cn";
import type { BirElection } from "@raket/contracts";

type CurrencyOption = { value: string; label: string };

export const CURRENCY_OPTIONS: ReadonlyArray<CurrencyOption> = [
  { value: "USD", label: "USD" },
  { value: "EUR", label: "EUR" },
  { value: "GBP", label: "GBP" },
  { value: "PHP", label: "PHP" },
];

export function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="mb-2 mt-4 text-xs font-bold uppercase tracking-wider text-gray-500">
      {children}
    </Text>
  );
}

type BirOption = { value: BirElection; label: string; description: string };

export const BIR_OPTIONS: ReadonlyArray<BirOption> = [
  {
    value: "8_percent",
    label: "8% of gross receipts",
    description:
      "Simplest option for most freelancers. One flat rate; replaces graduated income tax and percentage tax.",
  },
  {
    value: "graduated",
    label: "Graduated income tax + 1% percentage tax",
    description:
      "Pay tiered income tax (0–35%) plus 1% on gross receipts. Worth it only if you have large deductible expenses.",
  },
];

type BirElectionPickerProps = {
  value: BirElection;
  onChange: (next: BirElection) => void;
  onOpenBirInfo: () => void;
};

export function BirElectionPicker({ value, onChange, onOpenBirInfo }: BirElectionPickerProps) {
  return (
    <View className="gap-2">
      {BIR_OPTIONS.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            className={cn(
              "rounded-xl border bg-white p-3",
              active ? "border-brand-500 bg-brand-50" : "border-gray-200",
            )}
          >
            <View className="flex-row items-center gap-2">
              <View
                className={cn(
                  "h-5 w-5 items-center justify-center rounded-full border-2",
                  active ? "border-brand-600" : "border-gray-300",
                )}
              >
                {active ? <View className="h-2.5 w-2.5 rounded-full bg-brand-600" /> : null}
              </View>
              <Text className="flex-1 text-sm font-semibold text-gray-900">{option.label}</Text>
            </View>
            <Text className="mt-2 text-xs leading-5 text-gray-600">{option.description}</Text>
          </Pressable>
        );
      })}
      <Pressable
        onPress={onOpenBirInfo}
        accessibilityRole="link"
        accessibilityLabel="Learn about BIR 2303 on bir.gov.ph"
        className="mt-1 self-start"
      >
        <Text className="text-xs font-semibold text-brand-700">What is BIR 2303? ↗</Text>
      </Pressable>
    </View>
  );
}
