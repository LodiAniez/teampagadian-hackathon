import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";
import { TsRestExceptionFilter } from "./common/filters/ts-rest-exception.filter";
import type { EnvConfig } from "./common/config/env.schema";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  const config = app.get<ConfigService<EnvConfig, true>>(ConfigService);
  app.useGlobalFilters(new TsRestExceptionFilter());
  const allowedOrigins = config.get("CORS_ORIGINS", { infer: true });
  app.enableCors({
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
      // Server-to-server callers (Stripe webhooks, curl, health checks)
      // send no Origin header — let those through.
      if (!origin) return cb(null, true);
      return allowedOrigins.includes(origin)
        ? cb(null, true)
        : cb(new Error(`CORS: origin not allowed: ${origin}`));
    },
    credentials: true,
  });

  const port = config.get("PORT", { infer: true });
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Raket API listening on http://localhost:${port}/api/v1`);
}

bootstrap();
