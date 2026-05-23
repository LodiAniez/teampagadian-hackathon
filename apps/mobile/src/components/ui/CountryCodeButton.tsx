import { Pressable, Text, View, type PressableProps } from "react-native";
import { cn } from "@/lib/cn";

export type Country = {
  code: string; // ISO 3166-1 alpha-2 e.g. "PH"
  dialCode: string; // e.g. "+63"
  flag: string; // emoji e.g. "🇵🇭"
  name: string;
};

export const COUNTRIES: Country[] = [
  { code: "PH", dialCode: "+63", flag: "🇵🇭", name: "Philippines" },
  { code: "US", dialCode: "+1", flag: "🇺🇸", name: "United States" },
  { code: "AU", dialCode: "+61", flag: "🇦🇺", name: "Australia" },
  { code: "SG", dialCode: "+65", flag: "🇸🇬", name: "Singapore" },
  { code: "GB", dialCode: "+44", flag: "🇬🇧", name: "United Kingdom" },
  { code: "CA", dialCode: "+1", flag: "🇨🇦", name: "Canada" },
  { code: "JP", dialCode: "+81", flag: "🇯🇵", name: "Japan" },
  { code: "DE", dialCode: "+49", flag: "🇩🇪", name: "Germany" },
];

type Props = PressableProps & {
  country: Country;
  showDialCode?: boolean;
  className?: string;
};

export function CountryCodeButton({ country, showDialCode = true, className, ...rest }: Props) {
  return (
    <Pressable
      className={cn(
        "flex-row items-center gap-1 rounded-lg px-1 py-1 active:bg-gray-100",
        className,
      )}
      {...rest}
    >
      <Text className="text-xl leading-tight">{country.flag}</Text>
      {showDialCode ? (
        <Text className="text-sm font-medium text-gray-700">{country.dialCode}</Text>
      ) : null}
      <View className="h-3 w-px bg-gray-300 mx-0.5" />
    </Pressable>
  );
}
