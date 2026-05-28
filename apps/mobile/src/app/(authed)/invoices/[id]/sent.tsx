import { useEffect, useRef } from "react";
import { ActivityIndicator, Image, Pressable, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Screen } from "@/components/layout/Screen";
import { useSendInvoice } from "@/features/invoices/hooks/use-send-invoice";

export default function InvoiceSentScreen() {
  const { id, clientEmail } = useLocalSearchParams<{ id: string; clientEmail: string }>();
  const router = useRouter();
  const { send, result, isSending, error } = useSendInvoice();

  // Strict Mode double-invokes effects in dev, and Expo Router can remount the
  // screen on back-gesture restore. A ref guards against firing send() twice —
  // the server is idempotent but extra round-trips waste time and the second
  // catch swallows the response.
  const sentRef = useRef(false);
  useEffect(() => {
    if (sentRef.current) return;
    if (!id || !clientEmail) return;
    sentRef.current = true;
    send(id, clientEmail).catch(() => {});
  }, [id, clientEmail, send]);

  // Defense-in-depth: the form's saveAndGo should always pass clientEmail, but
  // if a route-param gap drops it the user would otherwise land on a blank
  // screen with no recovery path. Surface the problem explicitly.
  if (!id || !clientEmail) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Missing details", presentation: "modal" }} />
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text className="text-4xl">⚠</Text>
          <Text className="text-lg font-semibold text-gray-900">Missing client email</Text>
          <Text className="text-center text-sm text-gray-500">
            Go back and re-enter the client's email before sending the invoice.
          </Text>
          <Pressable
            onPress={() => router.back()}
            className="mt-2 rounded-xl bg-gray-100 px-6 py-3"
          >
            <Text className="font-semibold text-gray-700">Go back</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  if (isSending) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Sending…", presentation: "modal" }} />
        <View className="flex-1 items-center justify-center gap-3">
          <ActivityIndicator size="large" color="#0d9488" />
          <Text className="text-sm text-gray-600">Sending invoice to {clientEmail}…</Text>
        </View>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Send failed", presentation: "modal" }} />
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text className="text-4xl">⚠</Text>
          <Text className="text-lg font-semibold text-gray-900">Couldn't send invoice</Text>
          <Text className="text-center text-sm text-gray-500">{error.message}</Text>
          <Pressable
            onPress={() => router.back()}
            className="mt-2 rounded-xl bg-gray-100 px-6 py-3"
          >
            <Text className="font-semibold text-gray-700">Go back</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  if (result) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Invoice sent!", presentation: "modal" }} />
        <View className="flex-1 items-center justify-center gap-6 px-6">
          <View className="items-center gap-2">
            <Text className="text-4xl">✅</Text>
            <Text className="text-xl font-bold text-gray-900">Invoice sent!</Text>
            <Text className="text-center text-sm text-gray-500">
              Email delivered to {clientEmail}
            </Text>
          </View>

          <Image
            source={{ uri: result.qrCodeDataUrl }}
            className="h-56 w-56 rounded-2xl"
            accessibilityLabel="QR code for payment"
          />

          <View className="w-full gap-2">
            <Text className="text-center text-xs font-semibold uppercase tracking-wider text-gray-400">
              Payment link
            </Text>
            <View className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
              <Text selectable numberOfLines={2} className="text-xs text-brand-700">
                {result.checkoutUrl}
              </Text>
            </View>
          </View>
        </View>
      </Screen>
    );
  }

  return null;
}
