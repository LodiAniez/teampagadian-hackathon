import "../../global.css";
import * as SplashScreen from "expo-splash-screen";
import { Stack } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { queryClient } from "@/lib/query-client";
import { useSession } from "@/lib/auth";
import { AppSplashScreen } from "@/features/splash/components/SplashScreen";

// Prevent the native splash from auto-hiding before we're ready
SplashScreen.preventAutoHideAsync();

function RootLayoutInner() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const { isLoading: sessionLoading } = useSession();

  const ready = fontsLoaded && !sessionLoading;

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) {
    return <AppSplashScreen />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <RootLayoutInner />
    </QueryClientProvider>
  );
}
