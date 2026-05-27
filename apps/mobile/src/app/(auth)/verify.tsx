import { useState } from "react";
import { View, Text } from "react-native";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Screen } from "@/components/layout/Screen";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { supabase } from "@/lib/auth";
import { pickPostVerifyRoute, useFetchMe } from "@/features/profile";

const schema = z.object({
  token: z
    .string()
    .min(1, "Code is required")
    .regex(/^\d{6}$/, "Enter the 6-digit code"),
});

type FormValues = z.infer<typeof schema>;

export default function VerifyScreen() {
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone?: string }>();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchMe = useFetchMe();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { token: "" },
  });

  async function verify(token: string) {
    if (!phone) {
      setError("Phone number is missing. Go back and try again.");
      return;
    }
    setIsPending(true);
    setError(null);
    const { data, error: err } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: "sms",
    });
    if (err || !data.session) {
      setIsPending(false);
      setError(err?.message ?? "Verification failed");
      return;
    }
    // fetchMe throws on network / JWT-bridge-race. Falling through to
    // pickPostVerifyRoute(null) lands the user on /setup-profile, which is
    // the safer default than the dashboard when the profile state is unknown.
    let me: Awaited<ReturnType<typeof fetchMe>> | null = null;
    try {
      me = await fetchMe();
    } catch {
      // intentional: pickPostVerifyRoute(null) handles the routing
    }
    setIsPending(false);
    router.replace(pickPostVerifyRoute(me));
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: "Verify" }} />
      <View className="flex-1 justify-center gap-6 px-6">
        <View className="gap-1">
          <Text className="text-3xl font-bold text-gray-900">Verify your number</Text>
          <Text className="text-base text-gray-500">
            We sent a 6-digit code to {phone ?? "your phone"}.
          </Text>
        </View>

        <Controller
          control={control}
          name="token"
          render={({ field }) => (
            <TextField
              label="OTP code"
              placeholder="123456"
              keyboardType="number-pad"
              maxLength={6}
              value={field.value}
              onChangeText={field.onChange}
              error={errors.token?.message}
              hint="Check your SMS for the code"
            />
          )}
        />

        {error ? <Text className="text-sm text-red-500">{error}</Text> : null}

        <Button
          onPress={handleSubmit((v) => verify(v.token))}
          isLoading={isPending}
          size="lg"
          fullWidth
        >
          Verify
        </Button>
      </View>
    </Screen>
  );
}
