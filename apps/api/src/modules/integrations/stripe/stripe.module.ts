import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Stripe from "stripe";
import type { EnvConfig } from "@/common/config/env.schema";
import { StripeService } from "./stripe.service";
import { STRIPE_CLIENT, type StripeClient } from "./stripe.types";

@Module({
  providers: [
    {
      provide: STRIPE_CLIENT,
      useFactory: (config: ConfigService<EnvConfig, true>): StripeClient =>
        new Stripe(config.get("STRIPE_SECRET_KEY", { infer: true }), {
          apiVersion: "2026-04-22.dahlia",
          typescript: true,
        }),
      inject: [ConfigService],
    },
    StripeService,
  ],
  exports: [StripeService],
})
export class StripeModule {}
