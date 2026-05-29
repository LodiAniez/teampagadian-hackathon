import { View, Text } from "react-native";
import type { UiChatMessage } from "../types";
import { ToolResultCard } from "./tool-cards";

export function MessageBubble({ message }: { message: UiChatMessage }) {
  if (message.role === "user") {
    return (
      <View className="my-1 max-w-[85%] self-end rounded-2xl rounded-br-sm bg-brand-600 px-4 py-2.5">
        <Text className="text-[15px] leading-snug text-white">{message.text}</Text>
      </View>
    );
  }

  const isPending = message.text.length === 0 && message.toolResults.length === 0;

  return (
    <View className="my-1 max-w-[92%] self-start">
      <View className="rounded-2xl rounded-bl-sm border border-gray-200 bg-white px-4 py-2.5">
        {isPending ? (
          <Text className="text-[15px] text-gray-400">Thinking…</Text>
        ) : (
          message.text.length > 0 && (
            <Text className="text-[15px] leading-snug text-gray-900">{message.text}</Text>
          )
        )}
        {message.toolResults.map((result) => (
          <ToolResultCard
            key={result.toolCallId}
            toolName={result.toolName}
            output={result.output}
          />
        ))}
      </View>
    </View>
  );
}
