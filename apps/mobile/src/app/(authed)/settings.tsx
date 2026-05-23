import { View, Text } from "react-native";
import { Stack, useRouter } from "expo-router";
import { Screen } from "@/components/layout/Screen";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/auth";

export default function SettingsScreen() {
  const router = useRouter();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <Screen scroll>
      <Stack.Screen options={{ title: "Settings" }} />
      <View className="gap-6">
        <Text className="text-2xl font-bold text-gray-900">Settings</Text>
        <Button variant="destructive" onPress={handleSignOut} fullWidth>
          Sign out
        </Button>
      </View>
    </Screen>
  );
}
