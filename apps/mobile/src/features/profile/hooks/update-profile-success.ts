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
    await deps.queryClient.invalidateQueries({ queryKey: AUTH_ME_QUERY_KEY });
  };
}
