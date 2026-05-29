import { notFound } from "next/navigation";
import type { PublicInvoiceResponse } from "@raket/contracts";
import { serverApi } from "@/lib/api-client.server";
import { InvoiceConfirming } from "@/features/public-invoice/components/InvoiceConfirming";

type PageProps = {
  params: Promise<{ token: string }>;
};

async function fetchPublicInvoice(token: string): Promise<PublicInvoiceResponse | null> {
  try {
    const res = await serverApi.publicInvoices.getByToken({ params: { token } });
    if (res.status !== 200) return null;
    return res.body;
  } catch {
    return null;
  }
}

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default async function PublicInvoicePaidPage({ params }: PageProps) {
  const { token } = await params;
  const invoice = await fetchPublicInvoice(token);
  if (!invoice) notFound();

  if (invoice.status !== "paid") {
    return <InvoiceConfirming token={token} initialInvoice={invoice} />;
  }

  const freelancerName =
    invoice.freelancer.businessName ?? invoice.freelancer.name ?? "the freelancer";

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 py-12 text-center">
      <div className="rounded-2xl border border-emerald-200 bg-white p-8 shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-6 w-6"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M16.704 5.296a1 1 0 0 1 0 1.408l-7.5 7.5a1 1 0 0 1-1.414 0l-3.5-3.5a1 1 0 1 1 1.414-1.414L8.5 12.086l6.793-6.79a1 1 0 0 1 1.411 0Z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <h1 className="mt-4 text-2xl font-semibold text-slate-900">Payment received</h1>
        <p className="mt-2 text-slate-600">
          {freelancerName} has been notified that invoice{" "}
          <span className="font-medium text-slate-900">{invoice.number}</span> is paid.
        </p>
        <p className="mt-4 text-3xl font-semibold text-slate-900">
          {formatMoney(invoice.amount, invoice.currency)}
        </p>
        <p className="mt-6 text-xs text-slate-500">You can close this tab now.</p>
      </div>
    </main>
  );
}
