import { describe, expect, it } from "vitest";
import { buildChatSystemPrompt } from "../chat-system-prompt";

const baseUser = {
  name: "Maria Santos",
  bir2303Election: "EIGHT_PERCENT" as const,
  defaultCurrency: "PHP",
};

describe("buildChatSystemPrompt", () => {
  it("addresses the freelancer by name", () => {
    const prompt = buildChatSystemPrompt(baseUser, "2026-05-29");
    expect(prompt).toContain("Maria Santos");
  });

  it("falls back to a generic descriptor when the name is null", () => {
    const prompt = buildChatSystemPrompt({ ...baseUser, name: null }, "2026-05-29");
    expect(prompt.toLowerCase()).toContain("freelancer");
    expect(prompt).not.toContain("null");
  });

  it("includes today's date so relative questions resolve", () => {
    const prompt = buildChatSystemPrompt(baseUser, "2026-05-29");
    expect(prompt).toContain("2026-05-29");
  });

  it("states the user's BIR election", () => {
    expect(buildChatSystemPrompt(baseUser, "2026-05-29")).toContain("EIGHT_PERCENT");
    expect(
      buildChatSystemPrompt({ ...baseUser, bir2303Election: "GRADUATED" }, "2026-05-29"),
    ).toContain("GRADUATED");
  });

  it("describes the election as not set when the user has none", () => {
    const prompt = buildChatSystemPrompt({ ...baseUser, bir2303Election: null }, "2026-05-29");
    expect(prompt.toLowerCase()).toContain("not set");
    expect(prompt).not.toContain("null");
  });

  it("states the user's default currency", () => {
    expect(buildChatSystemPrompt({ ...baseUser, defaultCurrency: "USD" }, "2026-05-29")).toContain(
      "USD",
    );
  });

  it("instructs the assistant to report in PHP and to rely on tools, not invented numbers", () => {
    const prompt = buildChatSystemPrompt(baseUser, "2026-05-29");
    expect(prompt).toContain("₱");
    expect(prompt.toLowerCase()).toContain("tool");
    expect(prompt.toLowerCase()).toMatch(/never (invent|make up)/);
  });
});
