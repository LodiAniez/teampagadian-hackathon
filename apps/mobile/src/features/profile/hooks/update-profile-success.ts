export const AUTH_ME_QUERY_KEY = ["auth", "me"] as const;

type SuccessDeps = {
  clearDraft: () => Promise<void>;
  queryClient: {
    invalidateQueries: (filters: { queryKey: readonly unknown[] }) => Promise<void> | unknown;
  };
};

export function buildUpdateProfileSuccessHandler(deps: SuccessDeps) {
  return async () => {
    try {
      await deps.clearDraft();
    } catch {
      // AsyncStorage can fail (full disk, etc.). Don't block the redirect to dashboard;
      // a leftover draft is harmless — the wizard only shows when name === null.
    }
    try {
      await deps.queryClient.invalidateQueries({ queryKey: AUTH_ME_QUERY_KEY });
    } catch {
      // QueryClient can be torn down mid-flight on fast navigation. Letting this throw
      // would reject the onSuccess callback, making mutateAsync look like a failure to
      // the caller — and the user would be stranded on the wizard despite a 200 from
      // the server. A stale cache will refetch next time anyway.
    }
  };
}
