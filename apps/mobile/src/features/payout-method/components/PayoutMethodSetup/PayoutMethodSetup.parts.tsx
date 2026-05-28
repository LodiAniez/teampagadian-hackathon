import { View, Text, Modal, TextInput, Pressable } from "react-native";
import { Button } from "@/components/ui/Button";
import type { CardSummary } from "./use-payout-method-setup";

// ── CardSummaryCard ──────────────────────────────────────────────────────────

type CardSummaryCardProps = { summary: CardSummary };

export function CardSummaryCard({ summary }: CardSummaryCardProps) {
  const brand = summary.brand.charAt(0).toUpperCase() + summary.brand.slice(1);
  return (
    <View className="rounded-2xl border border-gray-200 bg-white p-4">
      <Text className="text-xs font-medium uppercase tracking-widest text-gray-400">
        Card added
      </Text>
      <Text className="mt-1 text-lg font-semibold text-gray-900">
        {brand} •••• {summary.last4}
      </Text>
    </View>
  );
}

// ── OtpModal ─────────────────────────────────────────────────────────────────

type OtpModalProps = {
  isVisible: boolean;
  code: string;
  error: string | null;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
};

export function OtpModal({ isVisible, code, error, onChange, onSubmit, onClose }: OtpModalProps) {
  return (
    <Modal visible={isVisible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/40" onPress={onClose} />
      <View className="rounded-t-3xl bg-white px-6 pb-10 pt-6">
        <Text className="text-xl font-bold text-gray-900">Confirm your identity</Text>
        <Text className="mt-1 text-sm text-gray-500">
          Enter the 6-digit code sent to your phone to confirm adding this card.
        </Text>

        <TextInput
          className="mt-6 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-center text-2xl font-bold tracking-widest text-gray-900"
          value={code}
          onChangeText={onChange}
          keyboardType="number-pad"
          maxLength={6}
          placeholder="——————"
          autoFocus
        />

        {error ? <Text className="mt-2 text-center text-sm text-red-500">{error}</Text> : null}

        <Button className="mt-6" onPress={onSubmit} disabled={code.length !== 6}>
          Confirm
        </Button>
      </View>
    </Modal>
  );
}
