import { describe, expect, it } from "vitest";
import { buildRequestMessages } from "./chat-request";

describe("buildRequestMessages", () => {
  it("maps role + text to role + content for non-empty turns", () => {
    const out = buildRequestMessages([
      { role: "user", text: "Who's my biggest client?" },
      { role: "assistant", text: "Acme Northwind, ₱412,800 across 6 invoices." },
    ]);
    expect(out).toEqual([
      { role: "user", content: "Who's my biggest client?" },
      { role: "assistant", content: "Acme Northwind, ₱412,800 across 6 invoices." },
    ]);
  });

  it("drops a blank assistant turn so a failed turn can't 400 the next send", () => {
    const out = buildRequestMessages([
      { role: "user", text: "Who's my biggest client?" },
      { role: "assistant", text: "" }, // errored before any token
      { role: "user", text: "try again" },
    ]);
    expect(out).toEqual([
      { role: "user", content: "Who's my biggest client?" },
      { role: "user", content: "try again" },
    ]);
  });

  it("drops whitespace-only turns", () => {
    expect(buildRequestMessages([{ role: "assistant", text: "   \n" }])).toEqual([]);
  });
});
