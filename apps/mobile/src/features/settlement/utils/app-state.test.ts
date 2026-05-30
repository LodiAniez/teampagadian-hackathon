import { describe, expect, it } from "vitest";
import { shouldSubscribe } from "./app-state";

describe("shouldSubscribe", () => {
  it("subscribes only while the app is in the foreground", () => {
    expect(shouldSubscribe("active")).toBe(true);
  });

  it("does not subscribe while backgrounded or inactive", () => {
    expect(shouldSubscribe("background")).toBe(false);
    expect(shouldSubscribe("inactive")).toBe(false);
  });
});
