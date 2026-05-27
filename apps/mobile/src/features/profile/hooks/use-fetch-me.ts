import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { AUTH_ME_QUERY_KEY } from "./update-profile-success";

// On-demand /auth/me fetch for event handlers (post-OTP, etc.). Routes the
// call through queryClient.fetchQuery so the result lands in the tanstack
// cache under AUTH_ME_QUERY_KEY — the same key buildUpdateProfileSuccessHandler
// invalidates. Without this, an `invalidateQueries({ queryKey: AUTH_ME_QUERY_KEY })`
// after profile updates would be a silent no-op.
//
// Throws on transport / serialization errors. We intentionally don't swallow
// to null here: a transient failure (network blip, JWT-bridge race) is NOT
// the same signal as "no profile". pickPostVerifyRoute treats the null case
// as "unknown state → send to setup-profile" so a thrown error caught by the
// caller can pass null through that helper for the same safe-default routing.
export function useFetchMe() {
  const queryClient = useQueryClient();
  return async () => {
    return await queryClient.fetchQuery({
      queryKey: AUTH_ME_QUERY_KEY,
      queryFn: () => api.auth.me.query(),
    });
  };
}
