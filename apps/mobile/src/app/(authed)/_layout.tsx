import { View } from "react-native";
import { Redirect, Stack } from "expo-router";
import { StripeProvider } from "@stripe/stripe-react-native";
import { useSession } from "@/lib/auth";
import { env } from "@/lib/env";

export default function AuthedLayout() {
  const { session, isLoading } = useSession();

  if (isLoading) {
    return <View className="flex-1 bg-gray-50" />;
  }

  if (!session) {
    return <Redirect href="/login" />;
  }

  return (
    <StripeProvider publishableKey={env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY}>
      <Stack screenOptions={{ headerShown: false }} />
    </StripeProvider>
  );
}
