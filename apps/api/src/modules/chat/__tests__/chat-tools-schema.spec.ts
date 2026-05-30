import { asSchema } from "@ai-sdk/provider-utils";
import { describe, expect, it } from "vitest";
import { mockDeep } from "vitest-mock-extended";
import { PrismaService } from "../../../common/prisma/prisma.service";
import { TaxCalculatorService } from "../../tax/tax-calculator.service";
import { buildChatToolDefs, CalculateTaxEstimateInputSchema } from "../chat-tools";
import { ChatToolsService } from "../chat-tools.service";

// Gemini's function-declaration schema requires every enum value to be a string
// (TYPE_STRING). A numeric enum — e.g. quarter as z.literal(1|2|3) — makes the
// provider reject the *whole* tool set with a 400, bricking every chat turn, not
// just the tool that owns the bad field. The chat unit tests mock the AI SDK, so
// only smoke:chat (not in CI) exercised a real schema; this test locks the
// constraint into CI instead.
function buildDefs() {
  const service = new ChatToolsService(mockDeep<PrismaService>(), mockDeep<TaxCalculatorService>());
  return buildChatToolDefs(service);
}

// Recursively collect every `enum` array a JSON Schema node carries, so we can
// assert across nested objects without coupling to a specific property path.
function collectEnums(node: unknown, acc: unknown[][] = []): unknown[][] {
  if (node === null || typeof node !== "object") return acc;
  const obj = node as Record<string, unknown>;
  if (Array.isArray(obj.enum)) acc.push(obj.enum);
  for (const value of Object.values(obj)) {
    if (Array.isArray(value)) value.forEach((v) => collectEnums(v, acc));
    else collectEnums(value, acc);
  }
  return acc;
}

describe("chat tool JSON schemas", () => {
  it("emit only string enum values (Gemini rejects numeric enums)", () => {
    const defs = buildDefs();

    for (const [name, def] of Object.entries(defs)) {
      const { jsonSchema } = asSchema(def.parameters);
      for (const values of collectEnums(jsonSchema)) {
        for (const value of values) {
          expect(typeof value, `${name} has a non-string enum value: ${String(value)}`).toBe(
            "string",
          );
        }
      }
    }
  });

  it("parses the model's string quarter into the numeric 1|2|3 the tax tool needs", () => {
    expect(CalculateTaxEstimateInputSchema.parse({ quarter: "2", year: 2026 })).toEqual({
      quarter: 2,
      year: 2026,
    });
  });
});
