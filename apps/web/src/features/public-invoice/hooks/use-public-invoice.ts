"use client";

import { useQuery } from "@tanstack/react-query";
import type { PublicInvoiceResponse } from "@raket/contracts";
import { api } from "../api/public-invoice.api";

type UsePublicInvoiceOptions = {
  initialData?: PublicInvoiceResponse;
};

export function usePublicInvoice(token: string, options: UsePublicInvoiceOptions = {}) {
  return useQuery({
    queryKey: ["public-invoice", token],
    queryFn: async () => {
      const res = await api.publicInvoices.getByToken({ params: { token } });
      if (res.status !== 200) {
        throw new Error("public_invoice_not_found");
      }
      return res.body;
    },
    initialData: options.initialData,
    staleTime: 30_000,
  });
}
