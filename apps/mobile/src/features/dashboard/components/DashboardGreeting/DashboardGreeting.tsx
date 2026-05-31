import { View, Text } from "react-native";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatPhp } from "@/lib/format";

type Props = {
  savingsVsPaypalPhp: number | undefined;
  isLoading: boolean;
};

/**
 * Top-of-dashboard greeting plus the "money saved vs PayPal this month" chip —
 * the headline value prop for freelancers. Pure presentational.
 */
export function DashboardGreeting({ savingsVsPaypalPhp, isLoading }: Props) {
  return (
    <View className="gap-2">
      <Text className="text-2xl font-bold text-gray-900">Welcome back 👋</Text>
      {isLoading || savingsVsPaypalPhp === undefined ? (
        <Skeleton className="h-7 w-64" />
      ) : (
        <View className="self-start rounded-full bg-brand-50 px-3 py-1.5">
          <Text className="text-sm font-semibold text-brand-700">
            You saved {formatPhp(savingsVsPaypalPhp)} vs PayPal this month
          </Text>
        </View>
      )}
    </View>
  );
}
