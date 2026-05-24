import { Redirect, Stack } from "expo-router";
import { env } from "@/lib/env";

// Mirror the bypass in (authed)/_layout.tsx: when dev bypass is on, never sit on /login —
// punt straight into the authed app so Expo Go doesn't strand you on the placeholder screen.
const isAuthBypassed = __DEV__ && env.EXPO_PUBLIC_DEV_BYPASS_AUTH === "true";

export default function AuthLayout() {
  if (isAuthBypassed) {
    return <Redirect href="/" />;
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}
