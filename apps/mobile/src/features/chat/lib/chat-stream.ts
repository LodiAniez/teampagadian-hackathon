// Parser + reducer for the AI SDK v6 UI-message stream (what the API's
// pipeUIMessageStreamToResponse emits): SSE frames `data: <json>\n\n`,
// terminated by `data: [DONE]`. Kept as pure functions so the streaming logic
// is unit-testable without a device or live endpoint; the hook wires them to
// expo/fetch.

export type UiChunk =
  | { type: "text-delta"; delta: string }
  | { type: "tool-input"; toolCallId: string; toolName: string }
  | { type: "tool-output"; toolCallId: string; output: unknown }
  | { type: "error"; errorText: string };

export interface SseParseResult {
  events: UiChunk[];
  rest: string;
}

// Splits complete `\n\n`-delimited SSE events off the front of `buffer`,
// returning the recognized chunks plus any trailing partial frame to prepend to
// the next read.
export function parseSseChunk(buffer: string): SseParseResult {
  const events: UiChunk[] = [];
  let working = buffer;
  let boundary = working.indexOf("\n\n");

  while (boundary !== -1) {
    const rawEvent = working.slice(0, boundary);
    working = working.slice(boundary + 2);

    const data = rawEvent
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(line.startsWith("data: ") ? 6 : 5))
      .join("\n")
      .trim();

    if (data && data !== "[DONE]") {
      const chunk = toUiChunk(data);
      if (chunk) events.push(chunk);
    }

    boundary = working.indexOf("\n\n");
  }

  return { events, rest: working };
}

function toUiChunk(data: string): UiChunk | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const p = parsed as Record<string, unknown>;

  switch (p.type) {
    case "text-delta":
      return typeof p.delta === "string" ? { type: "text-delta", delta: p.delta } : null;
    case "tool-input-start":
    case "tool-input-available":
      return typeof p.toolCallId === "string" && typeof p.toolName === "string"
        ? { type: "tool-input", toolCallId: p.toolCallId, toolName: p.toolName }
        : null;
    case "tool-output-available":
      return typeof p.toolCallId === "string"
        ? { type: "tool-output", toolCallId: p.toolCallId, output: p.output }
        : null;
    case "error":
      return { type: "error", errorText: typeof p.errorText === "string" ? p.errorText : "error" };
    default:
      return null;
  }
}

export interface ToolResult {
  toolCallId: string;
  toolName: string;
  output: unknown;
}

export interface ChatStreamState {
  text: string;
  toolResults: ToolResult[];
  error: string | null;
  // Internal: toolCallId → toolName, populated by tool-input before the output
  // arrives (tool-output frames carry only the id).
  toolNames: Record<string, string>;
}

export function initialStreamState(): ChatStreamState {
  return { text: "", toolResults: [], error: null, toolNames: {} };
}

export function reduceChunk(state: ChatStreamState, chunk: UiChunk): ChatStreamState {
  switch (chunk.type) {
    case "text-delta":
      return { ...state, text: state.text + chunk.delta };
    case "tool-input":
      return { ...state, toolNames: { ...state.toolNames, [chunk.toolCallId]: chunk.toolName } };
    case "tool-output":
      return {
        ...state,
        toolResults: [
          ...state.toolResults,
          {
            toolCallId: chunk.toolCallId,
            toolName: state.toolNames[chunk.toolCallId] ?? "unknown",
            output: chunk.output,
          },
        ],
      };
    case "error":
      return { ...state, error: chunk.errorText };
  }
}
