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

  it("routes a null result (caught network / JWT-bridge throw) to /setup-profile, not /", () => {
    // Prior behavior fell through to / which silently broke downstream
    // features for new users whose auth.me call hiccupped.
    expect(pickPostVerifyRoute(null)).toBe("/setup-profile");
  });

  it("routes a non-200 response (e.g. 401 from JWT bridge race) to /setup-profile", () => {
    expect(
      pickPostVerifyRoute({
        status: 401,
        body: { code: "UNAUTHORIZED", message: "Invalid token" },
      }),
    ).toBe("/setup-profile");
  });

  it("routes a 200 with a malformed body (contract drift) to /setup-profile", () => {
    // Body missing `name` entirely — e.g. the API renamed the field.
    // Old `as` cast would have read `undefined`, treated `undefined === null`
    // as false, and silently sent the user to /. Zod safeParse now catches
    // the drift and falls back to the safe default.
    expect(
      pickPostVerifyRoute({
        status: 200,
        body: { id: "user-1", phone: "+639171234567" },
      }),
    ).toBe("/setup-profile");
  });

  it("routes a 200 with body.name of the wrong type to /setup-profile", () => {
    // e.g. API starts returning `name: { first, last }` — parse fails.
    expect(
      pickPostVerifyRoute({
        status: 200,
        body: { name: { first: "Ada", last: "Lovelace" } },
      }),
    ).toBe("/setup-profile");
  });
});
