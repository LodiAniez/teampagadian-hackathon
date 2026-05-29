import { BadRequestException, Body, Controller, Post, Res, UseGuards } from "@nestjs/common";
import { ChatRequestSchema } from "@raket/contracts";
import type { Response } from "express";
import { AuthGuard } from "../../common/auth/auth.guard";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import type { AuthUser } from "../../common/auth/auth-user.types";
import { ChatService } from "./chat.service";

// Plain Nest controller (not ts-rest): the response is a streamed AI-SDK data
// stream, which ts-rest can't model. main.ts sets no global prefix, so the full
// path is declared here. The body is validated with the shared ChatRequestSchema
// since there's no ts-rest layer to do it.
@Controller("api/v1/ai")
@UseGuards(AuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post("chat")
  async chat(
    @CurrentUser() user: AuthUser,
    @Body() body: unknown,
    @Res() res: Response,
  ): Promise<void> {
    const parsed = ChatRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((i) => i.message).join("; "));
    }
    await this.chatService.streamChat(user.id, parsed.data.messages, res);
  }
}
