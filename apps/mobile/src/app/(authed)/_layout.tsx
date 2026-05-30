import { Fragment } from "react";
import { Text, View } from "react-native";
import { Redirect, Stack } from "expo-router";
import { StripeProvider } from "@stripe/stripe-react-native";
import { useSession } from "@/lib/auth";
import { env } from "@/lib/env";
import { usePayoutRealtime } from "@/features/settlement";

// Dev-only escape hatch: skip the Supabase-session redirect when EXPO_PUBLIC_DEV_BYPASS_AUTH=true.
// Always false in production builds (gated by __DEV__). Pair with EXPO_PUBLIC_DEV_BEARER so the
// API calls still carry a valid JWT. Remove once real login (TEA-17/18) works end-to-end.
const isAuthBypassed = __DEV__ && env.EXPO_PUBLIC_DEV_BYPASS_AUTH === "true";

export default function AuthedLayout() {
  const { session, isLoading } = useSession();

  // Open the realtime "money landed" subscription as soon as we have a session,
  // and reconnect on foreground (the hook is keyed on the user id and no-ops
  // without one). Mounted here so it lives for the whole authed session.
  usePayoutRealtime(session?.user.id);

  if (isLoading && !isAuthBypassed) {
    return <View className="flex-1 bg-gray-50" />;
  }

  if (!session && !isAuthBypassed) {
    return <Redirect href="/login" />;
  }

  return (
    <StripeProvider publishableKey={env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY}>
      <Fragment>
        {isAuthBypassed ? <DevAuthBypassedBanner /> : null}
        <Stack screenOptions={{ headerShown: false }} />
      </Fragment>
    </StripeProvider>
  );
}

function DevAuthBypassedBanner() {
  return (
    <View className="items-center bg-amber-500 px-3 py-1">
      <Text className="text-[10px] font-bold uppercase tracking-wider text-white">
        Dev mode · auth bypassed
      </Text>
    </View>
  );
}
