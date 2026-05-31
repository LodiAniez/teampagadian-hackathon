import { useCallback, useEffect, useRef, useState } from "react";
import { fetch as expoFetch } from "expo/fetch";
import { authHeader } from "@/lib/auth";
import { env } from "@/lib/env";
import { buildRequestMessages } from "../lib/chat-request";
import { initialStreamState, parseSseChunk, reduceChunk } from "../lib/chat-stream";
import type { UiChatMessage } from "../types";

const CHAT_URL = `${env.EXPO_PUBLIC_API_URL}/api/v1/ai/chat`;

let counter = 0;
function nextId(): string {
  counter += 1;
  return `m${Date.now()}-${counter}`;
}

// Owns the "Ask your books" conversation. Streams from POST /api/v1/ai/chat via
// expo/fetch (RN's global fetch can't stream a response body), parsing the AI
// SDK UI-message stream with the tested chat-stream helpers. Token updates are
// flushed on requestAnimationFrame so a fast stream doesn't thrash React.
export function useStreamingChat() {
  const [messages, setMessages] = useState<UiChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesRef = useRef<UiChatMessage[]>([]);
  const streamingRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const send = useCallback(async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || streamingRef.current) return;

    const userMessage: UiChatMessage = {
      id: nextId(),
      role: "user",
      text: trimmed,
      toolResults: [],
    };
    const assistantId = nextId();
    const history = [...messagesRef.current, userMessage];

    setMessages([...history, { id: assistantId, role: "assistant", text: "", toolResults: [] }]);
    setIsStreaming(true);
    streamingRef.current = true;
    setError(null);

    let streamState = initialStreamState();
    const flush = () => {
      rafRef.current = null;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, text: streamState.text, toolResults: streamState.toolResults }
            : m,
        ),
      );
    };
    const scheduleFlush = () => {
      if (rafRef.current === null) rafRef.current = requestAnimationFrame(flush);
    };

    try {
      const { authorization } = await authHeader();
      const response = await expoFetch(CHAT_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "text/event-stream",
          authorization,
        },
        body: JSON.stringify({
          messages: buildRequestMessages(history),
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Chat request failed (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const { events, rest } = parseSseChunk(buffer);
        buffer = rest;
        for (const event of events) streamState = reduceChunk(streamState, event);
        if (events.length > 0) scheduleFlush();
      }

      // Final flush so the last tokens/tool results aren't left on a pending frame.
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      flush();
      if (streamState.error) setError(streamState.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsStreaming(false);
      streamingRef.current = false;
    }
  }, []);

  return { messages, send, isStreaming, error };
}
