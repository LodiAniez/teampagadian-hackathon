import { api } from "@/lib/api-client";
import type { AddPayoutMethodBody, PayoutMethod } from "@raket/contracts";

export function useAddPayoutMethod() {
  const mutation = api.payoutMethods.add.useMutation();

  const saved: PayoutMethod | null = mutation.data?.status === 201 ? mutation.data.body : null;

  return {
    save: (body: AddPayoutMethodBody) => mutation.mutateAsync({ body }),
    saved,
    isPending: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}
