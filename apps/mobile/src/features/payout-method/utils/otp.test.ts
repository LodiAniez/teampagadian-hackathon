import { describe, expect, it } from "vitest";
import { DEMO_OTP_CODE, isValidDemoOtp } from "./otp";

describe("isValidDemoOtp", () => {
  it("accepts the demo code 123456", () => {
    expect(isValidDemoOtp("123456")).toBe(true);
    expect(DEMO_OTP_CODE).toBe("123456");
  });

  it("rejects an empty code", () => {
    expect(isValidDemoOtp("")).toBe(false);
  });

  it("rejects a non-demo code", () => {
    expect(isValidDemoOtp("111111")).toBe(false);
    expect(isValidDemoOtp("000000")).toBe(false);
  });

  it("rejects a partial code (no auto-pad)", () => {
    expect(isValidDemoOtp("12345")).toBe(false);
    expect(isValidDemoOtp("1234567")).toBe(false);
  });
});
