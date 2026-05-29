import Link from "next/link";
import { notFound } from "next/navigation";
import type { PublicInvoiceResponse } from "@raket/contracts";
import { serverApi } from "@/lib/api-client.server";
import { InvoicePreview } from "@/features/public-invoice/components/InvoicePreview";

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

export default async function PublicInvoicePreviewPage({ params }: PageProps) {
  const { token } = await params;
  const invoice = await fetchPublicInvoice(token);
  if (!invoice) notFound();

  if (invoice.status === "paid") {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 py-12 text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-emerald-700">
          Invoice {invoice.number}
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          This invoice has already been paid.
        </h1>
        <p className="mt-2 text-slate-600">No further action is needed.</p>
        <Link
          href={`/invoice/${invoice.token}/paid`}
          className="mt-6 text-sm font-medium text-brand-600 hover:underline"
        >
          View payment confirmation
        </Link>
      </main>
    );
  }

  return <InvoicePreview invoice={invoice} />;
}
