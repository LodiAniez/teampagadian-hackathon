import { View, Text } from "react-native";

export type CardSummaryProps = {
  brand: string;
  last4: string;
};

export function CardSummary({ brand, last4 }: CardSummaryProps) {
  const formattedBrand = brand.charAt(0).toUpperCase() + brand.slice(1);
  return (
    <View className="flex-row items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
      <View className="h-10 w-14 items-center justify-center rounded-md bg-gray-100">
        <Text className="text-xs font-bold text-gray-700">{formattedBrand}</Text>
      </View>
      <View>
        <Text className="text-base font-semibold text-gray-900">•••• {last4}</Text>
        <Text className="text-xs text-gray-500">Saved card</Text>
      </View>
    </View>
  );
}
