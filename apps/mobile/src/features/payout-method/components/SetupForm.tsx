import { useState } from "react";
import { View, Text } from "react-native";
import type { PayoutMethod } from "@raket/contracts";
import { Button } from "@/components/ui/Button";
import { usePaymentSheetFlow } from "../hooks/use-payment-sheet-flow";
import { useAddPayoutMethod } from "../hooks/use-add-payout-method";
import { CardSummary } from "./CardSummary";
import { OtpModal } from "./OtpModal";

type Props = {
  onSuccess: (method: PayoutMethod) => void;
};

// Two-step UX: (1) tokenize a card via Stripe PaymentSheet → (2) confirm with
// OTP modal → (3) persist via POST /payout-methods. Persistence is gated by
// the OTP modal to mirror the backend's FreshAuthGuard step-up.
export function SetupForm({ onSuccess }: Props) {
  const paymentSheet = usePaymentSheetFlow();
  const add = useAddPayoutMethod();
  const [tokenizedPmId, setTokenizedPmId] = useState<string | null>(null);
  const [savedMethod, setSavedMethod] = useState<PayoutMethod | null>(null);
  const [otpVisible, setOtpVisible] = useState(false);

  async function handleAddCard() {
    const result = await paymentSheet.tokenizeCard();
    if (!result) return;
    setTokenizedPmId(result.stripePaymentMethodId);
  }

  function handleRequestConfirm() {
    if (!tokenizedPmId) return;
    setOtpVisible(true);
  }

  async function handleOtpConfirm() {
    if (!tokenizedPmId) return;
    try {
      const method = await add.addCard(tokenizedPmId);
      setSavedMethod(method);
      setOtpVisible(false);
      onSuccess(method);
    } catch {
      // Surface via add.error below; keep the modal open so the user can retry.
    }
  }

  const errorMessage = paymentSheet.error?.message ?? add.error?.message ?? null;

  return (
    <View className="gap-6">
      <View className="gap-1">
        <Text className="text-2xl font-bold text-gray-900">Add a payout card</Text>
        <Text className="text-sm text-gray-500">
          We'll send your earnings here. Card is tokenized via Stripe — Raket never sees the number.
        </Text>
      </View>

      {tokenizedPmId ? (
        savedMethod && savedMethod.type === "card" ? (
          <CardSummary brand={savedMethod.details.brand} last4={savedMethod.details.last4} />
        ) : (
          <View className="rounded-xl border border-gray-200 bg-white p-4">
            <Text className="text-sm font-medium text-gray-700">Card ready</Text>
            <Text className="text-xs text-gray-500">
              Tap Confirm to verify with OTP and save this payout method.
            </Text>
          </View>
        )
      ) : null}

      {errorMessage ? <Text className="text-sm text-red-500">{errorMessage}</Text> : null}

      {tokenizedPmId ? (
        <Button onPress={handleRequestConfirm} isLoading={add.isPending} size="lg" fullWidth>
          Confirm
        </Button>
      ) : (
        <Button onPress={handleAddCard} isLoading={paymentSheet.isRunning} size="lg" fullWidth>
          Add card
        </Button>
      )}

      <OtpModal
        visible={otpVisible}
        onClose={() => setOtpVisible(false)}
        onConfirm={handleOtpConfirm}
        isSubmitting={add.isPending}
      />
    </View>
  );
}
