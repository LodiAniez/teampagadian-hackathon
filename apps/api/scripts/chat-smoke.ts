/**
 * TEA-55 chat smoke test — runs ONE real "Ask your books" turn through the full
 * ChatService → Gemini tool-use loop against your LOCAL database. Use it to
 * verify end-to-end that the tools' SQL works against real rows and that the
 * model answers sensibly. This is also the de-risking run for the TEA-54 raw
 * SQL (query_earnings / get_client_summary), which the unit tests mock.
 *
 * Unlike the unit tests (which mock the AI SDK), this calls the live Gemini API
 * and reads the real DB. Not run in CI.
 *
 * Run:
 *   npx tsx apps/api/scripts/chat-smoke.ts "Who's my biggest client?"
 *   npx tsx apps/api/scripts/chat-smoke.ts "How much did I earn this quarter?" <userId>
 *
 * Args:
 *   [prompt]   The question to ask (default: "Who's my biggest client?")
 *   [userId]   User to impersonate (default: the first user in the DB)
 *
 * Requires GEMINI_API_KEY + a reachable database (LOCAL_DATABASE_URL in
 * development) in the repo-root .env, and at least one user with some
 * paid invoices to produce interesting answers.
 */
import path from "node:path";
import { ConfigService } from "@nestjs/config";
import { config as loadEnv } from "dotenv";
import type { ChatMessage } from "@raket/contracts";
import type { EnvConfig } from "../src/common/config/env.schema";
import { PrismaService } from "../src/common/prisma/prisma.service";
import { ChatService } from "../src/modules/chat/chat.service";
import { ChatToolsService } from "../src/modules/chat/chat-tools.service";
import { TaxCalculatorService } from "../src/modules/tax/tax-calculator.service";

const TAG = "chat-smoke";

async function main(): Promise<void> {
  const [prompt = "Who's my biggest client?", userIdArg] = process.argv.slice(2);

  loadEnv({ path: path.resolve(__dirname, "../../../.env") });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY not set. Add it to the repo-root .env or export it.");
    process.exit(1);
  }

  // Real ConfigService over just the keys ChatService + PrismaService read.
  const config = new ConfigService<EnvConfig, true>({
    NODE_ENV: process.env.NODE_ENV ?? "development",
    GEMINI_API_KEY: apiKey,
    GEMINI_MODEL: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
    LOCAL_DATABASE_URL: process.env.LOCAL_DATABASE_URL,
    LOCAL_DIRECT_URL: process.env.LOCAL_DIRECT_URL,
  });

  const prisma = new PrismaService(config);
  await prisma.$connect();

  try {
    const userId = userIdArg ?? (await prisma.user.findFirst({ select: { id: true } }))?.id;
    if (!userId) {
      console.error("No users in the database. Seed a user (and some paid invoices) first.");
      process.exit(1);
    }

    const service = new ChatService(
      config,
      prisma,
      new ChatToolsService(prisma, new TaxCalculatorService(prisma)),
    );

    console.log(`[${TAG}] user=${userId}`);
    console.log(`[${TAG}] > ${prompt}\n`);

    const messages: ChatMessage[] = [{ role: "user", content: prompt }];
    const result = await service.createChatStream(userId, messages);

    // Stream the assistant's text to stdout as it arrives.
    for await (const delta of result.textStream) {
      process.stdout.write(delta);
    }
    process.stdout.write("\n\n");

    // Show which tools the model actually invoked, so SQL bugs surface here.
    const calls = await result.toolCalls;
    if (calls.length === 0) {
      console.warn(`[${TAG}] No tools were called — the model answered without querying data.`);
    } else {
      console.log(`[${TAG}] tool calls:`);
      for (const c of calls) console.log(`  - ${c.toolName}(${JSON.stringify(c.input)})`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(`[${TAG}] failed:`, err);
  process.exit(1);
});
