import { describe, expect, it, vi } from "vitest";
import { buildSettlementCompleteHandler } from "./settlement-complete";

function makeDeps() {
  return { queryClient: { invalidateQueries: vi.fn(() => Promise.resolve()) } };
}

describe("buildSettlementCompleteHandler", () => {
  it("invalidates both the dashboard and invoices query keys", async () => {
    const deps = makeDeps();
    await buildSettlementCompleteHandler(deps)();
    expect(deps.queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["dashboard"] });
    expect(deps.queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["invoices"] });
  });

  it("resolves cleanly when invalidateQueries throws (must not crash the screen)", async () => {
    const deps = makeDeps();
    deps.queryClient.invalidateQueries.mockRejectedValueOnce(new Error("QueryClient torn down"));
    await expect(buildSettlementCompleteHandler(deps)()).resolves.toBeUndefined();
  });
});
