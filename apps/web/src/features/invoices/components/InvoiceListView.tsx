import type { Invoice } from "@raket/contracts";

type Props = {
  invoices: Invoice[];
  isLoading: boolean;
  error: Error | null;
};

export function InvoiceListView({ invoices, isLoading, error }: Props) {
  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900">
        Something went wrong: {error.message}
      </div>
    );
  }

  if (isLoading && invoices.length === 0) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-md bg-slate-100" />
        ))}
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 p-8 text-center text-slate-600">
        No invoices yet. Create your first one to get paid.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-slate-200 rounded-md border border-slate-200">
      {invoices.map((inv) => (
        <li key={inv.id} className="flex items-center justify-between px-4 py-3">
          <div>
            <div className="text-sm font-medium text-slate-900">
              {inv.currency} {inv.amount.toFixed(2)}
            </div>
            <div className="text-xs text-slate-500">
              Due {inv.dueDate} · {inv.status}
            </div>
          </div>
          <span className="text-xs uppercase tracking-wide text-slate-500">{inv.status}</span>
        </li>
      ))}
    </ul>
  );
}
