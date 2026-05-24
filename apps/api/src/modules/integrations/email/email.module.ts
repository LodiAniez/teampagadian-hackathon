import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";
import type { EnvConfig } from "@/common/config/env.schema";
import { EmailService } from "./email.service";
import { RESEND_CLIENT, type ResendClient } from "./email.types";

@Module({
  providers: [
    {
      provide: RESEND_CLIENT,
      useFactory: (config: ConfigService<EnvConfig, true>): ResendClient =>
        new Resend(config.get("RESEND_API_KEY", { infer: true })),
      inject: [ConfigService],
    },
    EmailService,
  ],
  exports: [EmailService],
})
export class EmailModule {}
