export type NormalizedError = { message: string };

/**
 * ts-rest mutations expose either an `ErrorResponse` (typed body from a 4xx/5xx)
 * or a JS Error (network/parse failures). Components only care about a string
 * message — this collapses both shapes to `{ message } | null`.
 */
export function normalizeError(raw: unknown): NormalizedError | null {
  if (!raw) return null;
  if (typeof raw === "object" && raw !== null) {
    if ("body" in raw && raw.body && typeof raw.body === "object" && "message" in raw.body) {
      const message = (raw.body as { message: unknown }).message;
      if (typeof message === "string") return { message };
    }
    if ("message" in raw && typeof (raw as { message: unknown }).message === "string") {
      return { message: (raw as { message: string }).message };
    }
  }
  return { message: "Request failed" };
}
