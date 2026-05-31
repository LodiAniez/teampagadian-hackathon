import { useMemo } from "react";
import { api } from "@/lib/api-client";
import type { EarningsByClient } from "@raket/contracts";

export type ClientBarDatum = {
  clientName: string;
  totalPhp: number;
  invoiceCount: number;
};

export function useEarningsByClient() {
  const query = api.dashboard.getEarningsByClient.useQuery(["dashboard", "earnings-by-client"], {
    query: { limit: 5 },
  });

  const data = useMemo<ClientBarDatum[]>(() => {
    return (query.data?.body ?? []).map((c: EarningsByClient) => ({
      clientName: c.clientName.length > 16 ? c.clientName.slice(0, 14) + "…" : c.clientName,
      totalPhp: c.totalPhp,
      invoiceCount: c.invoiceCount,
    }));
  }, [query.data]);

  const max = useMemo(() => Math.max(...data.map((d) => d.totalPhp), 1), [data]);

  return { data, max, isLoading: query.isPending, error: query.error };
}
