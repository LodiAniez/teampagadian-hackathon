import { View, Text } from "react-native";
import { Button } from "@/components/ui/Button";
import { usePayoutMethodSetup } from "./use-payout-method-setup";
import { CardSummaryCard, OtpModal } from "./PayoutMethodSetup.parts";

export function PayoutMethodSetup() {
  const { stage, cardSummary, errorMessage, isTokenizing, onAddCard, onConfirm, otpModal } =
    usePayoutMethodSetup();

  return (
    <View className="flex-1 gap-6 px-4 pt-6">
      <View className="gap-1">
        <Text className="text-2xl font-bold text-gray-900">Where should we send your money?</Text>
        <Text className="text-sm text-gray-500">Add a card to receive payouts directly.</Text>
      </View>

      {stage === "card-ready" && cardSummary ? <CardSummaryCard summary={cardSummary} /> : null}

      {errorMessage ? <Text className="text-sm text-red-500">{errorMessage}</Text> : null}

      {stage !== "card-ready" ? (
        <Button onPress={onAddCard} isLoading={isTokenizing} disabled={isTokenizing}>
          Add card
        </Button>
      ) : (
        <Button onPress={onConfirm}>Confirm</Button>
      )}

      <OtpModal
        isVisible={otpModal.isVisible}
        code={otpModal.code}
        error={otpModal.error}
        onChange={otpModal.onChange}
        onSubmit={otpModal.onSubmit}
        onClose={otpModal.close}
      />
    </View>
  );
}
