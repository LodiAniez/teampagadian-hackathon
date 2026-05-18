import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { resolveDatabaseUrl, type DatabaseUrlEnv } from "../config/database-url";
import type { EnvConfig } from "../config/env.schema";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly usingLocalUrl: boolean;

  constructor(config: ConfigService<EnvConfig, true>) {
    const env: DatabaseUrlEnv = {
      NODE_ENV: config.get("NODE_ENV", { infer: true }),
      DATABASE_URL: config.get("DATABASE_URL", { infer: true }),
      DIRECT_URL: config.get("DIRECT_URL", { infer: true }),
      LOCAL_DATABASE_URL: config.get("LOCAL_DATABASE_URL", { infer: true }),
      LOCAL_DIRECT_URL: config.get("LOCAL_DIRECT_URL", { infer: true }),
    };

    const { url } = resolveDatabaseUrl(env);

    super({
      adapter: new PrismaPg({ connectionString: url }),
    });

    this.usingLocalUrl = env.NODE_ENV === "development" && Boolean(env.LOCAL_DATABASE_URL);
  }

  async onModuleInit(): Promise<void> {
    if (this.usingLocalUrl) {
      this.logger.log("Connecting to LOCAL_DATABASE_URL (NODE_ENV=development)");
    }
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
