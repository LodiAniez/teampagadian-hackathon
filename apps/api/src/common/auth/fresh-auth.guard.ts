import { type ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthGuard } from "./auth.guard";
import { PrismaService } from "../prisma/prisma.service";
import type { EnvConfig } from "../config/env.schema";
import type { AuthedRequest } from "./auth-user.types";

@Injectable()
export class FreshAuthGuard extends AuthGuard {
  private readonly freshWindowSeconds: number;

  constructor(prisma: PrismaService, config: ConfigService<EnvConfig, true>) {
    super(prisma, config);
    this.freshWindowSeconds = config.get("FRESH_AUTH_MAX_AGE_SECONDS", { infer: true });
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const token = this.extractBearerToken(req);
    const payload = await this.verifyToken(token);

    if (!payload.amr || payload.amr.length === 0) {
      throw new UnauthorizedException(
        "Token missing amr claim — cannot verify authentication freshness",
      );
    }

    const latestAuthTimestamp = Math.max(...payload.amr.map((a) => a.timestamp));
    const staleAfter = Math.floor(Date.now() / 1000) - this.freshWindowSeconds;
    if (latestAuthTimestamp < staleAfter) {
      throw new UnauthorizedException("Token is not fresh — re-authenticate and retry");
    }

    const user = await this.resolveUser(payload.sub, payload.phone);
    req.user = { id: user.id, phone: payload.phone };
    return true;
  }
}
