import { api } from "@/lib/api-client";

export function useSetupIntent() {
  const mutation = api.payoutMethods.setupIntent.useMutation();

  return {
    fetch: () => mutation.mutateAsync({}),
    isPending: mutation.isPending,
    error: mutation.error,
  };
}
