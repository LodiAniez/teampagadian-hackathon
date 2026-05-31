export const FX_COMPARISON_QUERY_KEY = "fx-compare";

/**
 * Pure query inputs for the FX comparison, kept free of the ts-rest api client
 * import so the keying and the "only fetch for a positive amount" rule are
 * testable in the node test env without pulling in native modules.
 */
export function fxComparisonQueryArgs(usdAmount: number) {
  return {
    queryKey: [FX_COMPARISON_QUERY_KEY, usdAmount] as const,
    query: { usd: usdAmount },
    enabled: usdAmount > 0,
  };
}
