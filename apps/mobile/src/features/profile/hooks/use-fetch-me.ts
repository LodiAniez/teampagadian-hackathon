import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { AUTH_ME_QUERY_KEY } from "./update-profile-success";

// On-demand /auth/me fetch for event handlers (post-OTP, etc.). Routes the
// call through queryClient.fetchQuery so the result lands in the tanstack
// cache under AUTH_ME_QUERY_KEY — the same key buildUpdateProfileSuccessHandler
// invalidates. Without this, an `invalidateQueries({ queryKey: AUTH_ME_QUERY_KEY })`
// after profile updates would be a silent no-op.
export function useFetchMe() {
  const queryClient = useQueryClient();
  return async () => {
    try {
      return await queryClient.fetchQuery({
        queryKey: AUTH_ME_QUERY_KEY,
        queryFn: () => api.auth.me.query(),
      });
    } catch {
      return null;
    }
  };
}
