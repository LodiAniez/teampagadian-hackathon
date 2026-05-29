import { useCallback } from "react";
import type { SetupIntentResponse } from "@raket/contracts";
import { api } from "@/lib/api-client";
import { normalizeError } from "@/lib/error";

export function useSetupIntent() {
  const mutation = api.payoutMethods.setupIntent.useMutation();
  const { mutateAsync } = mutation;

  const fetchSetupIntent = useCallback(async (): Promise<SetupIntentResponse> => {
    const res = await mutateAsync({});
    if (res.status !== 200) {
      throw new Error("Failed to create setup intent");
    }
    return res.body;
  }, [mutateAsync]);

  return {
    fetchSetupIntent,
    isPending: mutation.isPending,
    error: normalizeError(mutation.error),
  };
}
