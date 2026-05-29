import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { PayoutMethod } from "@raket/contracts";
import { api } from "@/lib/api-client";
import { normalizeError } from "@/lib/error";

export const PAYOUT_METHODS_QUERY_KEY = ["payout-methods"] as const;

export function useAddPayoutMethod() {
  const queryClient = useQueryClient();
  const mutation = api.payoutMethods.add.useMutation();
  const { mutateAsync } = mutation;

  const addCard = useCallback(
    async (stripePaymentMethodId: string): Promise<PayoutMethod> => {
      const res = await mutateAsync({ body: { type: "card", stripePaymentMethodId } });
      if (res.status !== 201) {
        throw new Error("Failed to add payout method");
      }
      try {
        await queryClient.invalidateQueries({ queryKey: PAYOUT_METHODS_QUERY_KEY });
      } catch {
        // Cache invalidation failure is non-fatal — list will refetch on next mount.
      }
      return res.body;
    },
    [mutateAsync, queryClient],
  );

  return {
    addCard,
    isPending: mutation.isPending,
    error: normalizeError(mutation.error),
  };
}
