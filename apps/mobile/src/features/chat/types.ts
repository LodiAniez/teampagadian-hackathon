import type { ToolResult } from "./lib/chat-stream";

export type ChatRole = "user" | "assistant";

export interface UiChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  toolResults: ToolResult[];
}
