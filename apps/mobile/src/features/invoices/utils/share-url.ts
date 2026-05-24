// Builds the public share URL we hand to clients via QR + Copy on the
// invoice success screen. Resolves to the web app's /pay/[id] route
// (TEA-44 — not yet built; URL is still scannable on stage today).
//
// `appUrl` is injected so this stays pure and testable without process.env.
// Production call site passes env.EXPO_PUBLIC_APP_URL.
export function buildInvoiceShareUrl(invoiceId: string, appUrl: string): string {
  const trimmed = appUrl.replace(/\/+$/, "");
  return `${trimmed}/pay/${encodeURIComponent(invoiceId)}`;
}
