import { useState } from "react";
import { Pressable, TextInput, View, Text } from "react-native";

export function Composer({
  onSend,
  disabled,
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  };

  const canSend = value.trim().length > 0 && !disabled;

  return (
    <View className="flex-row items-end gap-2 border-t border-gray-200 bg-white px-3 py-2">
      <TextInput
        className="max-h-28 flex-1 rounded-2xl bg-gray-100 px-4 py-2.5 text-[15px] text-gray-900"
        placeholder="Ask about your earnings…"
        placeholderTextColor="#9ca3af"
        value={value}
        onChangeText={setValue}
        multiline
        editable={!disabled}
        onSubmitEditing={submit}
        returnKeyType="send"
      />
      <Pressable
        onPress={submit}
        disabled={!canSend}
        className={`h-11 items-center justify-center rounded-full px-4 ${canSend ? "bg-brand-600" : "bg-gray-300"}`}
      >
        <Text className="font-semibold text-white">Send</Text>
      </Pressable>
    </View>
  );
}
