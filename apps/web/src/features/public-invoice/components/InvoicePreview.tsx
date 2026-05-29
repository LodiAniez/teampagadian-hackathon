"use client";

import { useState } from "react";
import type { PublicInvoiceResponse } from "@raket/contracts";

type Props = {
  invoice: PublicInvoiceResponse;
};

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  // Build via UTC parts to avoid timezone drift on dates without time component.
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function InvoicePreview({ invoice }: Props) {
  const [showQr, setShowQr] = useState(false);
  const freelancerName =
    invoice.freelancer.businessName ?? invoice.freelancer.name ?? "Your Freelancer";

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <header className="flex flex-col gap-2 border-b border-slate-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Invoice</p>
            <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">{invoice.number}</h1>
          </div>
          <div className="text-sm text-slate-600 sm:text-right">
            <p>
              From <span className="font-medium text-slate-900">{freelancerName}</span>
            </p>
            <p>Due {formatDate(invoice.dueDate)}</p>
          </div>
        </header>

        <section className="grid gap-6 py-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Billed to
            </p>
            <p className="mt-1 text-base font-medium text-slate-900">{invoice.client.name}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Issued</p>
            <p className="mt-1 text-base text-slate-900">{formatDate(invoice.issueDate)}</p>
          </div>
        </section>

        <section className="border-t border-slate-200 pt-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-3 font-semibold">Description</th>
                <th className="pb-3 text-right font-semibold">Qty</th>
                <th className="pb-3 text-right font-semibold">Rate</th>
                <th className="pb-3 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {invoice.lineItems.map((li, idx) => (
                <tr key={idx} className="text-slate-800">
                  <td className="py-3">{li.description}</td>
                  <td className="py-3 text-right tabular-nums">
                    {li.quantity} {li.unit}
                  </td>
                  <td className="py-3 text-right tabular-nums">
                    {formatMoney(li.rate, invoice.currency)}
                  </td>
                  <td className="py-3 text-right tabular-nums">
                    {formatMoney(li.amount, invoice.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 text-slate-900">
                <td colSpan={3} className="pt-4 text-right text-sm font-semibold">
                  Total
                </td>
                <td className="pt-4 text-right text-base font-semibold tabular-nums">
                  {formatMoney(invoice.amount, invoice.currency)}
                </td>
              </tr>
            </tfoot>
          </table>
        </section>

        {invoice.stripeCheckoutUrl && (
          <section className="mt-8 flex flex-col items-stretch gap-3 border-t border-slate-200 pt-8">
            <a
              href={invoice.stripeCheckoutUrl}
              className="inline-flex h-12 items-center justify-center rounded-md bg-brand-600 px-6 text-base font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            >
              Pay {formatMoney(invoice.amount, invoice.currency)}
            </a>
            {invoice.qrCodeDataUrl && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setShowQr((v) => !v)}
                  aria-expanded={showQr}
                  aria-controls="payment-qr-panel"
                  className="text-sm font-medium text-brand-700 hover:underline"
                >
                  {showQr ? "Hide QR code" : "Pay with QR code"}
                </button>
                {showQr && (
                  <div id="payment-qr-panel" className="mt-4 flex justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={invoice.qrCodeDataUrl}
                      alt="Payment QR code"
                      className="h-48 w-48 rounded-md border border-slate-200 bg-white p-2"
                    />
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </div>
      <p className="mt-6 text-center text-xs text-slate-500">
        Powered by Raket — payments for Filipino freelancers
      </p>
    </main>
  );
}
