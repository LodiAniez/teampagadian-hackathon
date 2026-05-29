import { useState } from "react";
import { Modal, View, Text, Pressable } from "react-native";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { isValidDemoOtp } from "../utils/otp";

export type OtpModalProps = {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting?: boolean;
};

export function OtpModal({ visible, onClose, onConfirm, isSubmitting }: OtpModalProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setCode("");
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleSubmit() {
    if (!isValidDemoOtp(code)) {
      setError("Incorrect code. Try 123456 for the demo.");
      return;
    }
    setError(null);
    onConfirm();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      accessibilityViewIsModal
    >
      <Pressable
        className="flex-1 items-center justify-center bg-black/40 px-6"
        onPress={handleClose}
      >
        <Pressable className="w-full rounded-2xl bg-white p-6" onPress={() => {}}>
          <Text className="text-xl font-bold text-gray-900">Confirm with OTP</Text>
          <Text className="mt-1 text-sm text-gray-500">
            Enter the 6-digit code we sent to verify this change.
          </Text>
          <View className="mt-4">
            <TextField
              label="OTP code"
              placeholder="123456"
              keyboardType="number-pad"
              maxLength={6}
              value={code}
              onChangeText={(t) => {
                setCode(t);
                if (error) setError(null);
              }}
              error={error ?? undefined}
              hint="Use 123456 for the demo"
            />
          </View>
          <View className="mt-6 flex-row gap-3">
            <Button variant="secondary" onPress={handleClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onPress={handleSubmit}
              isLoading={isSubmitting}
              disabled={code.length !== 6}
              className="flex-1"
            >
              Confirm
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
