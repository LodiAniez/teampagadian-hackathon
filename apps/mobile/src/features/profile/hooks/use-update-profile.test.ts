import { describe, expect, it, vi } from "vitest";
import { AUTH_ME_QUERY_KEY, buildUpdateProfileSuccessHandler } from "./update-profile-success";

describe("AUTH_ME_QUERY_KEY", () => {
  it("is the conventional ['auth', 'me'] key", () => {
    expect(AUTH_ME_QUERY_KEY).toEqual(["auth", "me"]);
  });
});

describe("buildUpdateProfileSuccessHandler", () => {
  function makeDeps() {
    return {
      clearDraft: vi.fn(async () => undefined),
      queryClient: { invalidateQueries: vi.fn(() => Promise.resolve()) },
    };
  }

  it("clears the saved draft on success", async () => {
    const deps = makeDeps();
    const onSuccess = buildUpdateProfileSuccessHandler(deps);
    await onSuccess();
    expect(deps.clearDraft).toHaveBeenCalledTimes(1);
  });

  it("invalidates the auth.me query key on success", async () => {
    const deps = makeDeps();
    const onSuccess = buildUpdateProfileSuccessHandler(deps);
    await onSuccess();
    expect(deps.queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: AUTH_ME_QUERY_KEY,
    });
  });

  it("still invalidates the query when clearDraft rejects (stale draft must not block dashboard)", async () => {
    const deps = makeDeps();
    deps.clearDraft.mockRejectedValueOnce(new Error("secure-store unavailable"));
    const onSuccess = buildUpdateProfileSuccessHandler(deps);
    await onSuccess();
    expect(deps.queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: AUTH_ME_QUERY_KEY,
    });
  });

  it("resolves cleanly when invalidateQueries throws (must not block navigation)", async () => {
    const deps = makeDeps();
    deps.queryClient.invalidateQueries.mockRejectedValueOnce(new Error("QueryClient torn down"));
    const onSuccess = buildUpdateProfileSuccessHandler(deps);
    // If onSuccess rejected here, mutateAsync would reject, submitSetupProfile
    // would return { ok: false }, and the user would be stranded on the wizard
    // despite the server already accepting the PATCH.
    await expect(onSuccess()).resolves.toBeUndefined();
  });
});
