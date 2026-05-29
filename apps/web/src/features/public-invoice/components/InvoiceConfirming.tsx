"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { PublicInvoiceResponse } from "@raket/contracts";
import { usePublicInvoice } from "../hooks/use-public-invoice";

type Props = {
  token: string;
  initialInvoice: PublicInvoiceResponse;
};

// Rendered when Stripe redirects to /paid but the webhook hasn't flipped
// status yet. The user refreshes on demand; once the hook sees `paid` we
// trigger an RSC refresh so the server page re-renders the success state.
// Polling intentionally avoided — the demo path is short-lived enough that
// a refresh button is sufficient (see plan).
export function InvoiceConfirming({ token, initialInvoice }: Props) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { data, refetch, isFetching } = usePublicInvoice(token, { initialData: initialInvoice });

  const invoice = data ?? initialInvoice;

  useEffect(() => {
    if (invoice.status === "paid") {
      router.refresh();
    }
  }, [invoice.status, router]);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 py-12 text-center">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Invoice {invoice.number}
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Confirming your payment…</h1>
        <p className="mt-3 text-slate-600">
          Stripe says your payment went through. Give us a few seconds to record it on our end.
        </p>
        <button
          type="button"
          onClick={async () => {
            setIsRefreshing(true);
            try {
              await refetch();
              router.refresh();
            } finally {
              setIsRefreshing(false);
            }
          }}
          disabled={isRefreshing || isFetching}
          className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-brand-600 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-60"
        >
          {isRefreshing || isFetching ? "Refreshing…" : "Refresh"}
        </button>
      </div>
    </main>
  );
}
