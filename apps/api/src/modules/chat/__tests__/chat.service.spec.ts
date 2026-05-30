import { ConfigService } from "@nestjs/config";
import type { ServerResponse } from "node:http";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep } from "vitest-mock-extended";
import type { EnvConfig } from "../../../common/config/env.schema";
import { PrismaService } from "../../../common/prisma/prisma.service";
import { ChatToolsService } from "../chat-tools.service";

// Mock the AI SDK so the service can be tested without a live Gemini call.
const streamText = vi.fn();
const stepCountIs = vi.fn((n: number) => ({ __stepCountIs: n }));
const tool = vi.fn((def: unknown) => def);
vi.mock("ai", () => ({
  streamText: (args: unknown) => streamText(args),
  stepCountIs: (n: number) => stepCountIs(n),
  tool: (def: unknown) => tool(def),
}));
const createGoogleGenerativeAI = vi.fn((_opts: unknown) => (model: string) => ({ __model: model }));
vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: (opts: unknown) => createGoogleGenerativeAI(opts),
}));

// Imported after the mocks are registered.
const { ChatService } = await import("../chat.service");

const USER_ID = "f0e1d2c3-b4a5-6e7d-8c9b-0a1b2c3d4e5f";

function buildService() {
  const prisma = mockDeep<PrismaService>();
  const tools = mockDeep<ChatToolsService>();
  // A real ConfigService over the two keys the service reads (same approach as
  // parse-quotation-smoke.ts) — avoids mocking ConfigService's overloads.
  const config = new ConfigService<EnvConfig, true>({
    GEMINI_API_KEY: "test-key",
    GEMINI_MODEL: "gemini-2.5-flash",
  });
  const service = new ChatService(config, prisma, tools);
  return { service, prisma };
}

describe("ChatService.streamChat", () => {
  let pipe: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    pipe = vi.fn();
    streamText.mockReturnValue({ pipeUIMessageStreamToResponse: pipe });
  });

  async function run(
    prismaUser: unknown = {
      name: "Maria Santos",
      bir2303Election: "EIGHT_PERCENT",
      defaultCurrency: "PHP",
    },
  ) {
    const { service, prisma } = buildService();
    prisma.user.findUnique.mockResolvedValueOnce(prismaUser as never);
    const res = {} as ServerResponse;
    await service.streamChat(USER_ID, [{ role: "user", content: "Who's my biggest client?" }], res);
    return { res };
  }

  it("calls streamText with the system prompt, the message history, and a bounded step count", async () => {
    await run();

    expect(streamText).toHaveBeenCalledTimes(1);
    const args = streamText.mock.calls[0][0];
    expect(args.system).toContain("Maria Santos");
    expect(args.messages).toEqual([{ role: "user", content: "Who's my biggest client?" }]);
    expect(stepCountIs).toHaveBeenCalledWith(5);
    expect(args.stopWhen).toEqual({ __stepCountIs: 5 });
  });

  it("exposes exactly the four chat tools to the model", async () => {
    await run();
    const args = streamText.mock.calls[0][0];
    expect(Object.keys(args.tools).sort()).toEqual(
      [
        "calculate_tax_estimate",
        "get_client_summary",
        "get_invoice_status",
        "query_earnings",
      ].sort(),
    );
  });

  it("pipes the UI message stream to the response", async () => {
    const { res } = await run();
    expect(pipe).toHaveBeenCalledWith(res);
  });

  it("builds the Gemini provider from GEMINI_API_KEY (no separate google key)", async () => {
    await run();
    expect(createGoogleGenerativeAI).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: "test-key" }),
    );
  });

  it("looks up only the requesting user for the prompt", async () => {
    const { service, prisma } = buildService();
    prisma.user.findUnique.mockResolvedValueOnce({
      name: null,
      bir2303Election: null,
      defaultCurrency: "USD",
    } as never);
    await service.streamChat(USER_ID, [{ role: "user", content: "hi" }], {} as ServerResponse);
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: USER_ID } }),
    );
  });
});
