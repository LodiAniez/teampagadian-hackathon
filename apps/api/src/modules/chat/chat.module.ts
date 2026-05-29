import { Module } from "@nestjs/common";
import { TaxModule } from "../tax/tax.module";
import { ChatToolsService } from "./chat-tools.service";

// The Gemini tool-use loop + streaming endpoint (TEA-55) will live here too and
// consume ChatToolsService via buildChatToolDefs. For now this slice owns the
// four data tools behind "Ask your books."
@Module({
  imports: [TaxModule],
  providers: [ChatToolsService],
  exports: [ChatToolsService],
})
export class ChatModule {}
