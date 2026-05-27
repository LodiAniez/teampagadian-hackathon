export function parseNumber(text: string): number {
  const cleaned = text.replace(/[^0-9.]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
