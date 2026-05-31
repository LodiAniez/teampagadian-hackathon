import type { FxComparison } from "@raket/contracts";
import { api } from "@/lib/api-client";
import { fxComparisonQueryArgs } from "./fx-query";

export { FX_COMPARISON_QUERY_KEY, fxComparisonQueryArgs } from "./fx-query";

export type UseFxComparisonResult = {
  comparison: FxComparison | undefined;
  isLoading: boolean;
  isError: boolean;
};

export function useFxComparison({ usdAmount }: { usdAmount: number }): UseFxComparisonResult {
  const args = fxComparisonQueryArgs(usdAmount);
  const query = api.fx.compare.useQuery(
    args.queryKey,
    { query: args.query },
    // queryKey is repeated here because this @ts-rest/react-query version types
    // the options as TanStack v5's UseQueryOptions, which requires it.
    { queryKey: args.queryKey, enabled: args.enabled },
  );

  return {
    comparison: query.data?.status === 200 ? query.data.body : undefined,
    // A disabled query reports `pending`; only surface loading once it can run.
    isLoading: args.enabled && query.isPending,
    isError: query.isError,
  };
}
