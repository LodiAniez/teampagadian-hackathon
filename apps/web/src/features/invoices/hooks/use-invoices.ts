"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { authHeader } from "@/lib/auth";
import type { Invoice, InvoiceStatus } from "@raket/contracts";

type UseInvoicesOptions = {
  status?: InvoiceStatus;
};

type UseInvoicesResult = {
  invoices: Invoice[];
  isLoading: boolean;
  error: Error | null;
};

export function useInvoices({ status }: UseInvoicesOptions = {}): UseInvoicesResult {
  const query = useQuery({
    queryKey: ["invoices", { status: status ?? null }],
    queryFn: async () => {
      const result = await api.invoices.list({
        query: { limit: 20, ...(status ? { status } : {}) },
        extraHeaders: await authHeader(),
      });
      if (result.status !== 200) {
        throw new Error(`Failed to load invoices (status ${result.status})`);
      }
      return result.body;
    },
  });

  return {
    invoices: query.data?.data ?? [],
    isLoading: query.isPending,
    error: query.error instanceof Error ? query.error : null,
  };
}
