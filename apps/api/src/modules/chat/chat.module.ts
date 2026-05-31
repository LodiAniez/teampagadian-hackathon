import { Module } from "@nestjs/common";
import { CommonAuthModule } from "../../common/auth/auth.module";
import { TaxModule } from "../tax/tax.module";
import { ChatController } from "./chat.controller";
import { ChatService } from "./chat.service";
import { ChatToolsService } from "./chat-tools.service";

// "Ask your books": the four data tools (ChatToolsService) plus the streaming
// Gemini tool-use endpoint (ChatController → ChatService) that exposes them.
@Module({
  imports: [TaxModule, CommonAuthModule],
  controllers: [ChatController],
  providers: [ChatToolsService, ChatService],
  exports: [ChatToolsService],
})
export class ChatModule {}
