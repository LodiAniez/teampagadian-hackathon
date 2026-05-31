import { DEMO_PROMPT_CHIPS } from "@raket/contracts";
import { Pressable, ScrollView, Text } from "react-native";

export function PromptChips({
  onSelect,
  disabled,
}: {
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerClassName="gap-2 px-1 py-2"
    >
      {DEMO_PROMPT_CHIPS.map((chip) => (
        <Pressable
          key={chip.id}
          disabled={disabled}
          onPress={() => onSelect(chip.prompt)}
          className="rounded-full border border-gray-200 bg-white px-3 py-2 active:bg-gray-100"
        >
          <Text className="text-xs font-medium text-gray-600">{chip.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
