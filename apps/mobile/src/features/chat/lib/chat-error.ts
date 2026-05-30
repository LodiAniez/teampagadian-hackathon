// Turns a raw chat error (an AI-SDK stream `error` part or a network failure)
// into a calm, user-facing message. Most failures in this build are Gemini
// free-tier rate limits, which arrive as "Failed after N attempts … quota /
// 429 / RESOURCE_EXHAUSTED …" — surfacing that raw text mid-demo looks broken,
// so we show a reassuring "try again" instead. Anything unrecognized gets a
// plain generic message.
const RATE_LIMIT_RE =
  /quota|rate.?limit|too many requests|429|resource.?exhausted|failed after \d+ attempt/i;

const RATE_LIMIT_MESSAGE =
  "We're on Gemini's free tier and just hit its rate limit — not a real error. Give it a few seconds and try again.";
const GENERIC_MESSAGE = "Something went wrong. Please try again.";

export function toFriendlyChatError(raw: string | null | undefined): string {
  if (raw && RATE_LIMIT_RE.test(raw)) return RATE_LIMIT_MESSAGE;
  return GENERIC_MESSAGE;
}
