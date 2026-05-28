import type { InvoiceEmailData, FreelancerEmailData, InvoiceEmailLineItem } from "../email.types";

export interface RenderInvoiceEmailParams {
  invoice: InvoiceEmailData;
  freelancer: FreelancerEmailData;
  paymentUrl: string;
}

// Email clients strip <style> blocks and reject most modern CSS — every style
// is inlined on the element. Layout uses presentational tables for the same
// reason (flexbox + grid still fail in Outlook 2016/365 desktop).
// Content-ID for the QR PNG attached inline by EmailService. Referenced in the
// HTML as `<img src="cid:${QR_CONTENT_ID}">`. Gmail strips base64 `data:` URIs
// in <img src>, so CID inline attachments are the only portable option.
export const QR_CONTENT_ID = "qr-invoice";

export function renderInvoiceEmail(params: RenderInvoiceEmailParams): string {
  const { invoice, freelancer, paymentUrl } = params;
  const lineItemRows = invoice.lineItems.map(renderLineItemRow).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Invoice ${escapeHtml(invoice.number)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f6f8;padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;">
<tr><td style="padding:32px 32px 8px;">
<p style="margin:0 0 12px;font-size:14px;color:#6b7280;">Invoice ${escapeHtml(invoice.number)}</p>
<h1 style="margin:0 0 8px;font-size:22px;line-height:1.3;color:#111827;">Hi ${escapeHtml(invoice.clientName)},</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:1.55;color:#374151;">Here's the invoice for the work completed. You can pay with a card via the button below — funds settle to ${escapeHtml(freelancer.displayName)} the same day.</p>
</td></tr>

<tr><td align="center" style="padding:0 32px 8px;">
<a href="${escapeAttr(paymentUrl)}" style="display:inline-block;background:#0066ff;color:#ffffff;text-decoration:none;padding:16px 36px;border-radius:8px;font-size:16px;font-weight:600;line-height:1;">Pay ${escapeHtml(invoice.amount)} ${escapeHtml(invoice.currency)}</a>
</td></tr>

<tr><td align="center" style="padding:24px 32px 8px;">
<p style="margin:0 0 12px;font-size:13px;color:#6b7280;">Or scan to pay from your phone</p>
<img src="cid:${QR_CONTENT_ID}" alt="QR code to pay invoice ${escapeAttr(invoice.number)}" width="160" height="160" style="display:block;border:0;outline:none;text-decoration:none;">
</td></tr>

<tr><td style="padding:16px 32px 24px;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#9ca3af;text-align:center;word-break:break-all;">Or paste this link into your browser:<br><span style="color:#6b7280;">${escapeHtml(paymentUrl)}</span></p>
</td></tr>

<tr><td style="padding:0 32px;">
<hr style="border:0;border-top:1px solid #e5e7eb;margin:0;">
</td></tr>

<tr><td style="padding:24px 32px 8px;">
<h2 style="margin:0 0 16px;font-size:15px;color:#111827;">Invoice summary</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<th align="left" style="padding:8px 0;font-size:12px;color:#6b7280;font-weight:500;text-transform:uppercase;letter-spacing:0.04em;border-bottom:1px solid #e5e7eb;">Description</th>
<th align="right" style="padding:8px 0;font-size:12px;color:#6b7280;font-weight:500;text-transform:uppercase;letter-spacing:0.04em;border-bottom:1px solid #e5e7eb;">Amount</th>
</tr>
${lineItemRows}
<tr>
<td align="right" style="padding:16px 0 0;font-size:14px;color:#111827;font-weight:600;">Total</td>
<td align="right" style="padding:16px 0 0;font-size:14px;color:#111827;font-weight:600;">${escapeHtml(invoice.amount)} ${escapeHtml(invoice.currency)}</td>
</tr>
</table>
<p style="margin:16px 0 0;font-size:13px;color:#6b7280;">Due <strong style="color:#374151;">${escapeHtml(invoice.dueDate)}</strong>.</p>
</td></tr>

<tr><td style="padding:24px 32px 32px;">
<p style="margin:0;font-size:14px;line-height:1.6;color:#374151;">Thanks,<br><strong style="color:#111827;">${escapeHtml(freelancer.name)}</strong>${freelancer.businessName ? `<br><span style="color:#6b7280;">${escapeHtml(freelancer.businessName)}</span>` : ""}${freelancer.contactEmail ? `<br><a href="mailto:${escapeAttr(freelancer.contactEmail)}" style="color:#0066ff;text-decoration:none;">${escapeHtml(freelancer.contactEmail)}</a>` : ""}</p>
</td></tr>
</table>

<p style="margin:16px 0 0;font-size:11px;color:#9ca3af;text-align:center;">Sent via Raket — get paid by global clients in minutes.</p>
</td></tr>
</table>
</body>
</html>`;
}

export function renderInvoiceEmailText(params: RenderInvoiceEmailParams): string {
  const { invoice, freelancer, paymentUrl } = params;
  const lineItems = invoice.lineItems
    .map((li) => `  - ${li.description}: ${li.amount} ${invoice.currency}`)
    .join("\n");

  const signatureLines = [
    "Thanks,",
    freelancer.name,
    ...(freelancer.businessName ? [freelancer.businessName] : []),
    ...(freelancer.contactEmail ? [freelancer.contactEmail] : []),
  ];

  return [
    `Hi ${invoice.clientName},`,
    "",
    `Here's invoice ${invoice.number} from ${freelancer.displayName}.`,
    "",
    `Pay ${invoice.amount} ${invoice.currency}: ${paymentUrl}`,
    "",
    "Summary:",
    lineItems,
    "",
    `Total: ${invoice.amount} ${invoice.currency}`,
    `Due: ${invoice.dueDate}`,
    "",
    ...signatureLines,
  ].join("\n");
}

function renderLineItemRow(item: InvoiceEmailLineItem): string {
  return `<tr>
<td align="left" style="padding:12px 0;font-size:14px;color:#374151;border-bottom:1px solid #f3f4f6;">${escapeHtml(item.description)}</td>
<td align="right" style="padding:12px 0;font-size:14px;color:#374151;border-bottom:1px solid #f3f4f6;">${escapeHtml(item.amount)}</td>
</tr>`;
}

// HTML body context per OWASP: only &, <, > need escaping. Apostrophes/quotes
// are only dangerous inside attribute values (use escapeAttr there).
function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Attribute context: also escape quotes so a malicious value can't break out
// of the double-quoted attribute. All template attributes use double quotes.
function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/"/g, "&quot;");
}
