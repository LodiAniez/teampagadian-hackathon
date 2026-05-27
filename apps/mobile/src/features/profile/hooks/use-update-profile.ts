import { useQueryClient } from "@tanstack/react-query";
import type { UpdateProfileDto } from "@raket/contracts";
import { api } from "@/lib/api-client";
import { normalizeError } from "@/lib/error";
import { clearDraft } from "../utils/draft-storage";
import { buildUpdateProfileSuccessHandler } from "./update-profile-success";

export { AUTH_ME_QUERY_KEY, buildUpdateProfileSuccessHandler } from "./update-profile-success";

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const mutation = api.auth.updateProfile.useMutation({
    onSuccess: buildUpdateProfileSuccessHandler({ clearDraft, queryClient }),
  });

  return {
    save: (body: UpdateProfileDto) => mutation.mutateAsync({ body }),
    isSaving: mutation.isPending,
    error: normalizeError(mutation.error),
    reset: mutation.reset,
  };
}
