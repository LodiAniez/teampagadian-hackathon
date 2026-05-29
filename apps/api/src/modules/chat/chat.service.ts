import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { ChatMessage } from "@raket/contracts";
import { stepCountIs, streamText, tool, type ToolSet } from "ai";
import type { ServerResponse } from "node:http";
import type { EnvConfig } from "../../common/config/env.schema";
import { todayIso } from "../../common/utils/dates";
import { PrismaService } from "../../common/prisma/prisma.service";
import { buildChatSystemPrompt } from "./chat-system-prompt";
import { buildChatToolDefs } from "./chat-tools";
import { ChatToolsService } from "./chat-tools.service";

// Bound the tool-use loop: each round is a model call + optional tool call, so
// 5 steps is comfortably enough for "look something up, then answer" while
// stopping a malformed prompt from looping indefinitely.
const MAX_STEPS = 5;

@Injectable()
export class ChatService {
  private readonly google: ReturnType<typeof createGoogleGenerativeAI>;
  private readonly model: string;

  constructor(
    config: ConfigService<EnvConfig, true>,
    private readonly prisma: PrismaService,
    private readonly chatTools: ChatToolsService,
  ) {
    // Reuse the existing GEMINI_API_KEY rather than @ai-sdk/google's default
    // GOOGLE_GENERATIVE_AI_API_KEY env var, so there's a single source of truth.
    this.google = createGoogleGenerativeAI({
      apiKey: config.get("GEMINI_API_KEY", { infer: true }),
    });
    this.model = config.get("GEMINI_MODEL", { infer: true });
  }

  async streamChat(userId: string, messages: ChatMessage[], res: ServerResponse): Promise<void> {
    const result = await this.createChatStream(userId, messages);
    result.pipeUIMessageStreamToResponse(res);
  }

  // The streamText result for a chat turn. streamChat pipes it to an HTTP
  // response; the smoke script consumes its textStream directly. Streaming is
  // lazy, so the model isn't called until the result is consumed.
  async createChatStream(userId: string, messages: ChatMessage[]) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, bir2303Election: true, defaultCurrency: true },
    });

    return streamText({
      model: this.google(this.model),
      system: buildChatSystemPrompt(
        {
          name: user?.name ?? null,
          bir2303Election: user?.bir2303Election ?? null,
          defaultCurrency: user?.defaultCurrency ?? "PHP",
        },
        todayIso(),
      ),
      messages,
      tools: this.buildTools(userId),
      stopWhen: stepCountIs(MAX_STEPS),
      // Surface mid-stream failures to the client as an error part instead of a
      // silently hung socket.
      onError: ({ error }) => {
        // eslint-disable-next-line no-console
        console.error(`[chat] stream error for user ${userId}:`, error);
      },
    });
  }

  // Wrap the provider-agnostic tool defs (TEA-54) as AI-SDK tools, closing over
  // userId so it can never be a model-supplied parameter.
  private buildTools(userId: string): ToolSet {
    const defs = buildChatToolDefs(this.chatTools);
    return Object.fromEntries(
      Object.entries(defs).map(([name, def]) => [
        name,
        tool({
          description: def.description,
          inputSchema: def.parameters,
          execute: (input) => def.execute(userId, input),
        }),
      ]),
    );
  }
}
