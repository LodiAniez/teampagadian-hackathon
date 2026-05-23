import { useState } from "react";
import { View, Text } from "react-native";
import { Stack, useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Screen } from "@/components/layout/Screen";
import { Button } from "@/components/ui/Button";
import { PhoneField } from "@/components/ui/PhoneField";
import { supabase } from "@/lib/auth";

const schema = z.object({
  localNumber: z
    .string()
    .min(1, "Phone number is required")
    .regex(/^\d{7,12}$/, "Enter a valid phone number without the country code"),
  dialCode: z.string().min(1),
});

type FormValues = z.infer<typeof schema>;

export default function LoginScreen() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { localNumber: "", dialCode: "+63" },
  });

  async function submit(phone: string) {
    setIsPending(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({ phone });
    setIsPending(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.push({ pathname: "/verify", params: { phone } });
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: "Sign in" }} />
      <View className="flex-1 justify-center gap-6 px-6">
        <View className="gap-1">
          <Text className="text-3xl font-bold text-gray-900">Welcome to Raket</Text>
          <Text className="text-base text-gray-500">Enter your phone number to get started.</Text>
        </View>

        <Controller
          control={control}
          name="localNumber"
          render={({ field }) => (
            <PhoneField
              defaultCountry="PH"
              value={field.value}
              onChangeText={field.onChange}
              onCountryChange={(c) => setValue("dialCode", c.dialCode)}
              error={errors.localNumber?.message}
              hint="We'll send a one-time code to this number"
            />
          )}
        />

        {error ? <Text className="text-sm text-red-500">{error}</Text> : null}

        <Button
          onPress={handleSubmit((v) => submit(`${v.dialCode}${v.localNumber}`))}
          isLoading={isPending}
          size="lg"
          fullWidth
        >
          Send OTP
        </Button>
      </View>
    </Screen>
  );
}
