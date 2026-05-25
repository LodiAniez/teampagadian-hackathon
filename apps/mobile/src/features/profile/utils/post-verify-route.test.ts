import { describe, expect, it } from "vitest";
import { pickPostVerifyRoute } from "./post-verify-route";

const FIXED_DATES = {
  createdAt: "2026-05-25T08:00:00.000Z",
  updatedAt: "2026-05-25T08:00:00.000Z",
};

describe("pickPostVerifyRoute", () => {
  it("routes brand-new users (name === null) to /setup-profile", () => {
    expect(
      pickPostVerifyRoute({
        status: 200,
        body: {
          id: "user-1",
          phone: "+639171234567",
          name: null,
          businessName: null,
          defaultCurrency: "USD",
          defaultHourlyRate: null,
          bir2303Election: null,
          ...FIXED_DATES,
        },
      }),
    ).toBe("/setup-profile");
  });

  it("routes existing users (name set) to /", () => {
    expect(
      pickPostVerifyRoute({
        status: 200,
        body: {
          id: "user-1",
          phone: "+639171234567",
          name: "Ada Lovelace",
          businessName: "Ada Freelance",
          defaultCurrency: "USD",
          defaultHourlyRate: null,
          bir2303Election: "8_percent",
          ...FIXED_DATES,
        },
      }),
    ).toBe("/");
  });

  it("falls back to / on null result (network/parse error)", () => {
    expect(pickPostVerifyRoute(null)).toBe("/");
  });

  it("falls back to / on a non-200 response (e.g. 401 from a transient JWT bridge race)", () => {
    expect(
      pickPostVerifyRoute({
        status: 401,
        body: { code: "UNAUTHORIZED", message: "Invalid token" },
      }),
    ).toBe("/");
  });
});
