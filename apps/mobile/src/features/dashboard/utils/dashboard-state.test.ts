import { describe, expect, it } from "vitest";
import { isDashboardEmpty } from "./dashboard-state";

describe("isDashboardEmpty", () => {
  it("is empty for a brand-new user with no earnings and no invoices", () => {
    expect(isDashboardEmpty({ totalEarnedPhp: 0, recentInvoiceCount: 0 })).toBe(true);
  });

  it("is not empty once the user has earned anything", () => {
    expect(isDashboardEmpty({ totalEarnedPhp: 250, recentInvoiceCount: 0 })).toBe(false);
  });

  it("is not empty once the user has any invoice (even unpaid)", () => {
    expect(isDashboardEmpty({ totalEarnedPhp: 0, recentInvoiceCount: 2 })).toBe(false);
  });
});
