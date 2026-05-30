import type { ChatRole } from "../types";

export interface RequestMessage {
  role: ChatRole;
  content: string;
}

// Builds the POST body's message list from the on-screen history. Messages with
// empty text are dropped: an assistant turn that errors before its first token
// is left blank, and the backend's ChatRequestSchema rejects content "" (min 1)
// — so without this filter one failed turn would 400 every subsequent send and
// brick the conversation until reload. User turns are always non-empty (the
// composer trims and guards), so only blank assistant turns are removed.
export function buildRequestMessages(
  history: readonly { role: ChatRole; text: string }[],
): RequestMessage[] {
  return history
    .filter((m) => m.text.trim().length > 0)
    .map((m) => ({ role: m.role, content: m.text }));
}
