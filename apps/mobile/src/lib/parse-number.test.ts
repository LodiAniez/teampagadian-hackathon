import { describe, expect, it } from "vitest";
import { parseNumber } from "./parse-number";

describe("parseNumber", () => {
  it("parses a plain integer", () => {
    expect(parseNumber("80")).toBe(80);
  });

  it("parses a decimal", () => {
    expect(parseNumber("12.50")).toBe(12.5);
  });

  it("strips currency symbols and letters", () => {
    expect(parseNumber("$80")).toBe(80);
    expect(parseNumber("80 USD")).toBe(80);
  });

  it("returns 0 for an empty string", () => {
    expect(parseNumber("")).toBe(0);
  });

  it("rejects negatives — strips the sign so '-80' becomes 80", () => {
    expect(parseNumber("-80")).toBe(80);
  });

  it("returns 0 if the resulting number is not finite", () => {
    expect(parseNumber("..")).toBe(0);
  });
});
