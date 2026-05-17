import { InvoiceList } from "@/features/invoices";

export default function InvoicesPage() {
  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
      </header>
      <InvoiceList />
    </div>
  );
}
