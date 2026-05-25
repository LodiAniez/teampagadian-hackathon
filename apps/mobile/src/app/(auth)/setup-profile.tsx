import { Stack } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Screen } from "@/components/layout/Screen";
import { SetupProfileForm } from "@/features/profile";

const BIR_URL = "https://bir.gov.ph";

export default function SetupProfileScreen() {
  return (
    <Screen scroll>
      <Stack.Screen options={{ title: "Set up your profile" }} />
      <SetupProfileForm onOpenBirInfo={() => void WebBrowser.openBrowserAsync(BIR_URL)} />
    </Screen>
  );
}
