"use client";

import { useInvoices } from "../hooks/use-invoices";
import { InvoiceListView } from "./InvoiceListView";

export function InvoiceList() {
  const { invoices, isLoading, error } = useInvoices();
  return <InvoiceListView invoices={invoices} isLoading={isLoading} error={error} />;
}
