import { asSchema } from "@ai-sdk/provider-utils";
import type { TaxComputation } from "@raket/contracts";
import { describe, expect, it } from "vitest";
import { mockDeep } from "vitest-mock-extended";
import { PrismaService } from "../../../common/prisma/prisma.service";
import { TaxCalculatorService } from "../../tax/tax-calculator.service";
import { buildChatToolDefs } from "../chat-tools";
import { ChatToolsService } from "../chat-tools.service";

const USER_ID = "f0e1d2c3-b4a5-6e7d-8c9b-0a1b2c3d4e5f";

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

  // Regression for the quarter double-parse: the AI SDK validates the model's
  // args against the tool's `inputSchema` (def.parameters) and hands the parsed
  // value to execute, which re-parses with the *same* schema. So the schema must
  // round-trip its own output. A `.transform()` on quarter would mutate "2" → 2
  // on the SDK's parse, then throw on execute's re-parse (number into a string
  // enum) — bricking calculate_tax_estimate while the other three tools work.
  // Driving the real execute through the pre-parsed value catches that; parsing
  // the schema only once (as the prior test did) does not.
  it("survives the SDK validate → execute re-parse and forwards a numeric quarter", async () => {
    const computation: TaxComputation = {
      grossReceiptsPhp: 487200,
      election: "EIGHT_PERCENT",
      taxDuePhp: 38976,
      formCode: "1701Q",
      formName: "Quarterly Income Tax Return",
      deadline: "2026-05-15",
      breakdown: "₱487,200 × 8% = ₱38,976",
      invoiceCount: 4,
      paymentBreakdown: [],
    };
    const prisma = mockDeep<PrismaService>();
    const tax = mockDeep<TaxCalculatorService>();
    prisma.user.findUnique.mockResolvedValueOnce({ bir2303Election: null } as never);
    tax.computeQuarterly.mockResolvedValueOnce(computation);
    const def = buildChatToolDefs(new ChatToolsService(prisma, tax)).calculate_tax_estimate;

    // What the SDK hands execute: the model's string args, already parsed once.
    const sdkParsed = def.parameters.parse({ quarter: "2", year: 2026 });

    await expect(def.execute(USER_ID, sdkParsed)).resolves.toBeDefined();
    expect(tax.computeQuarterly).toHaveBeenCalledWith(USER_ID, 2, 2026, "EIGHT_PERCENT");
  });
});
