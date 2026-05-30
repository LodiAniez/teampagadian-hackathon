import { useEffect, useRef } from "react";
import { Stack } from "expo-router";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { View, Text } from "react-native";
import { Screen } from "@/components/layout/Screen";
import { useStreamingChat } from "../hooks/use-streaming-chat";
import type { UiChatMessage } from "../types";
import { Composer } from "./Composer";
import { MessageBubble } from "./MessageBubble";
import { PromptChips } from "./PromptChips";

export function ChatScreen() {
  const { messages, send, isStreaming, error } = useStreamingChat();
  const listRef = useRef<FlashListRef<UiChatMessage>>(null);

  useEffect(() => {
    if (messages.length > 0) listRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  return (
    <Screen className="p-0">
      <Stack.Screen options={{ title: "Ask your books" }} />
      <View className="flex-1">
        {messages.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-center text-lg font-semibold text-gray-700">Ask your books</Text>
            <Text className="mt-1 text-center text-sm text-gray-400">
              Ask about your earnings, invoices, tax estimate, or clients.
            </Text>
          </View>
        ) : (
          <FlashList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => <MessageBubble message={item} />}
            contentContainerClassName="px-4 py-3"
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          />
        )}

        {error && (
          <View className="mx-4 mb-1 rounded-lg bg-red-50 px-3 py-2">
            <Text className="text-sm text-red-600">{error}</Text>
          </View>
        )}

        <View className="px-3">
          <PromptChips onSelect={send} disabled={isStreaming} />
        </View>
        <Composer onSend={send} disabled={isStreaming} />
      </View>
    </Screen>
  );
}
