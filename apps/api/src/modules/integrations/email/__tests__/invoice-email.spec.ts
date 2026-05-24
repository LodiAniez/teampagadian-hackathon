import { describe, expect, it } from "vitest";
import {
  renderInvoiceEmail,
  renderInvoiceEmailText,
  type RenderInvoiceEmailParams,
} from "../templates/invoice-email";

function buildParams(overrides: Partial<RenderInvoiceEmailParams> = {}): RenderInvoiceEmailParams {
  return {
    invoice: {
      number: "INV-2026-0001",
      amount: "1,500.00",
      currency: "USD",
      dueDate: "May 30, 2026",
      clientName: "Acme Corp",
      lineItems: [
        { description: "Landing page design", amount: "1,200.00" },
        { description: "Brand kit", amount: "300.00" },
      ],
    },
    freelancer: {
      displayName: "Juan's Studio",
      name: "Juan dela Cruz",
      businessName: "Juan's Studio",
      contactEmail: "juan@juanstudio.com",
    },
    paymentUrl: "https://checkout.stripe.com/c/pay/cs_test_abc123",
    qrCodeDataUrl: "data:image/png;base64,iVBORw0KGgo=",
    ...overrides,
  };
}

describe("renderInvoiceEmail", () => {
  it("includes a Pay Now link pointing at the Stripe Checkout URL", () => {
    const html = renderInvoiceEmail(buildParams());

    expect(html).toMatch(/<a[^>]*href="https:\/\/checkout\.stripe\.com\/c\/pay\/cs_test_abc123"/);
  });

  it("includes the QR code as an inline image", () => {
    const html = renderInvoiceEmail(buildParams());

    expect(html).toMatch(/<img[^>]*src="data:image\/png;base64,iVBORw0KGgo="/);
  });

  it("includes the payment URL as a copy-paste fallback", () => {
    const html = renderInvoiceEmail(buildParams());

    // URL should appear at least twice — once as the button href and once as plain text
    const occurrences = html.split("https://checkout.stripe.com/c/pay/cs_test_abc123").length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });

  it("lists every line item description", () => {
    const html = renderInvoiceEmail(buildParams());

    expect(html).toContain("Landing page design");
    expect(html).toContain("Brand kit");
  });

  it("shows the total amount with currency", () => {
    const html = renderInvoiceEmail(buildParams());

    expect(html).toContain("1,500.00");
    expect(html).toContain("USD");
  });

  it("addresses the client by name and signs as the freelancer", () => {
    const html = renderInvoiceEmail(buildParams());

    expect(html).toContain("Acme Corp");
    expect(html).toContain("Juan's Studio");
  });

  it("constrains the email container to 600px for mobile-safe rendering", () => {
    const html = renderInvoiceEmail(buildParams());

    expect(html).toMatch(/max-width:\s*600px/);
  });

  it("includes the invoice number and due date", () => {
    const html = renderInvoiceEmail(buildParams());

    expect(html).toContain("INV-2026-0001");
    expect(html).toContain("May 30, 2026");
  });

  it("renders the freelancer's name in the signature (TEA-36 AC)", () => {
    const html = renderInvoiceEmail(buildParams());

    expect(html).toContain("Juan dela Cruz");
  });

  it("renders the business name in the signature when present (TEA-36 AC)", () => {
    const html = renderInvoiceEmail(buildParams());

    // businessName === displayName in the default fixture, so check the
    // signature occurrence specifically by looking for the dedicated span.
    expect(html).toMatch(/<span[^>]*>Juan's Studio<\/span>/);
  });

  it("omits the business-name line when the freelancer has no businessName", () => {
    const html = renderInvoiceEmail(
      buildParams({
        freelancer: {
          displayName: "Juan dela Cruz",
          name: "Juan dela Cruz",
          contactEmail: "juan@example.com",
        },
      }),
    );

    // No business-name span should be rendered when businessName is undefined.
    expect(html).not.toMatch(/<span[^>]*>Juan dela Cruz<\/span>/);
  });

  it("renders the contact email as a mailto link in the signature (TEA-36 AC)", () => {
    const html = renderInvoiceEmail(buildParams());

    expect(html).toMatch(
      /<a[^>]*href="mailto:juan@juanstudio\.com"[^>]*>juan@juanstudio\.com<\/a>/,
    );
  });
});

describe("renderInvoiceEmailText", () => {
  it("includes the payment URL in plain text", () => {
    const text = renderInvoiceEmailText(buildParams());

    expect(text).toContain("https://checkout.stripe.com/c/pay/cs_test_abc123");
  });

  it("includes the invoice number and total", () => {
    const text = renderInvoiceEmailText(buildParams());

    expect(text).toContain("INV-2026-0001");
    expect(text).toContain("1,500.00");
  });

  it("contains no HTML tags", () => {
    const text = renderInvoiceEmailText(buildParams());

    expect(text).not.toMatch(/<[^>]+>/);
  });

  it("renders name, business name, and contact email in the signature", () => {
    const text = renderInvoiceEmailText(buildParams());

    expect(text).toContain("Juan dela Cruz");
    expect(text).toContain("Juan's Studio");
    expect(text).toContain("juan@juanstudio.com");
  });

  it("omits the business-name line when the freelancer has no businessName", () => {
    const text = renderInvoiceEmailText(
      buildParams({
        freelancer: {
          displayName: "Juan dela Cruz",
          name: "Juan dela Cruz",
          contactEmail: "juan@example.com",
        },
      }),
    );

    // Signature should be exactly: Thanks, / name / contactEmail
    expect(text).toMatch(/Thanks,\nJuan dela Cruz\njuan@example\.com$/);
  });
});
