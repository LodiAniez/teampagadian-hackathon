import {
  CanActivate,
  type ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { PrismaService } from "../prisma/prisma.service";
import type { EnvConfig } from "../config/env.schema";
import type { AuthedRequest } from "./auth-user.types";

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);
  private readonly jwks: JWTVerifyGetKey;
  private readonly issuer: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<EnvConfig, true>,
  ) {
    const supabaseUrl = config.get("SUPABASE_URL", { infer: true });
    this.jwks = createRemoteJWKSet(new URL("/auth/v1/.well-known/jwks.json", supabaseUrl));
    this.issuer = new URL("/auth/v1", supabaseUrl).toString();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization;

    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing or malformed Authorization header");
    }

    const token = header.slice("Bearer ".length);

    let supabaseUserId: string;
    let phone: string;
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        audience: "authenticated",
        algorithms: ["RS256", "ES256"],
      });
      if (typeof payload.sub !== "string" || payload.sub.length === 0) {
        throw new UnauthorizedException("Token missing sub claim");
      }
      // Supabase is SMS-only today, so every issued JWT carries `phone`. If
      // email/OAuth providers get enabled later, this guard needs to accept
      // tokens without `phone` (and likely store `email` on req.user).
      if (typeof payload.phone !== "string" || payload.phone.length === 0) {
        throw new UnauthorizedException("Token missing phone claim");
      }
      supabaseUserId = payload.sub;
      phone = payload.phone;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      // Surface JWKS fetch failures, key-rotation races, network blips so
      // ops can tell a real outage from a bad token.
      this.logger.warn(`JWT verification failed: ${err instanceof Error ? err.message : err}`);
      throw new UnauthorizedException("Invalid or expired token");
    }

    const user = await this.resolveUser(supabaseUserId, phone);
    req.user = { id: user.id, phone };
    return true;
  }

  private async resolveUser(supabaseUserId: string, phone: string): Promise<{ id: string }> {
    const linked = await this.prisma.user.findUnique({ where: { supabaseUserId } });
    if (linked) return linked;

    const byPhone = await this.prisma.user.findUnique({ where: { phone } });
    if (byPhone) {
      return this.prisma.user.update({
        where: { id: byPhone.id },
        data: { supabaseUserId },
      });
    }

    try {
      return await this.prisma.user.create({ data: { supabaseUserId, phone } });
    } catch (err) {
      // A concurrent request for the same brand-new user can race past the
      // find-find-create path and win — second request hits the supabaseUserId
      // or phone unique constraint. Re-read what the winner stored.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const winner = await this.prisma.user.findUnique({ where: { supabaseUserId } });
        if (winner) return winner;
      }
      throw err;
    }
  }
}
