export type NormalizedError = { message: string };

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
