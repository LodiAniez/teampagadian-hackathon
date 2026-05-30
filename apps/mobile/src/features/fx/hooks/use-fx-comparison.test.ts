import { describe, expect, it } from "vitest";
import { FX_COMPARISON_QUERY_KEY, fxComparisonQueryArgs } from "./fx-query";

describe("fxComparisonQueryArgs", () => {
  it("keys the query on the provider name and the usd amount", () => {
    expect(fxComparisonQueryArgs(1000).queryKey).toEqual([FX_COMPARISON_QUERY_KEY, 1000]);
  });

  it("sends the usd amount as the compare query param", () => {
    expect(fxComparisonQueryArgs(250).query).toEqual({ usd: 250 });
  });

  it("is enabled only for a positive usd amount", () => {
    expect(fxComparisonQueryArgs(1000).enabled).toBe(true);
    expect(fxComparisonQueryArgs(0).enabled).toBe(false);
    expect(fxComparisonQueryArgs(-5).enabled).toBe(false);
  });
});
