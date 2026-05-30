import { describe, expect, it } from "vitest";
import { toFriendlyChatError } from "./chat-error";

const RATE_LIMIT =
  "The assistant is getting a lot of questions right now. Give it a few seconds and try again.";
const GENERIC = "Something went wrong. Please try again.";

describe("toFriendlyChatError", () => {
  it("maps a Gemini quota error to the calm retry message", () => {
    const raw =
      "Failed after 3 attempts. Last error: You exceeded your current quota. " +
      "Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20, model: gemini-2.5-flash";
    expect(toFriendlyChatError(raw)).toBe(RATE_LIMIT);
  });

  it("treats the bare SDK retry signature as rate-limited", () => {
    expect(toFriendlyChatError("Failed after 3 attempts.")).toBe(RATE_LIMIT);
  });

  it("matches other rate-limit phrasings (429 / resource exhausted)", () => {
    expect(toFriendlyChatError("429 Too Many Requests")).toBe(RATE_LIMIT);
    expect(toFriendlyChatError("RESOURCE_EXHAUSTED")).toBe(RATE_LIMIT);
  });

  it("falls back to a generic friendly message for unknown errors", () => {
    expect(toFriendlyChatError("Chat request failed (500)")).toBe(GENERIC);
  });

  it("returns the generic message for null/empty input", () => {
    expect(toFriendlyChatError(null)).toBe(GENERIC);
    expect(toFriendlyChatError("")).toBe(GENERIC);
  });
});
