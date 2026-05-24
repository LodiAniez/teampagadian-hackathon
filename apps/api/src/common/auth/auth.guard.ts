import {
  CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { PrismaService } from "../prisma/prisma.service";
import type { EnvConfig } from "../config/env.schema";
import type { AuthedRequest } from "./auth-user.types";

@Injectable()
export class AuthGuard implements CanActivate {
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
      if (typeof payload.phone !== "string" || payload.phone.length === 0) {
        throw new UnauthorizedException("Token missing phone claim");
      }
      supabaseUserId = payload.sub;
      phone = payload.phone;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException("Invalid or expired token");
    }

    let user = await this.prisma.user.findUnique({ where: { supabaseUserId } });
    if (!user) {
      const byPhone = await this.prisma.user.findUnique({ where: { phone } });
      if (byPhone) {
        user = await this.prisma.user.update({
          where: { id: byPhone.id },
          data: { supabaseUserId },
        });
      } else {
        user = await this.prisma.user.create({
          data: { supabaseUserId, phone },
        });
      }
    }

    req.user = { id: user.id, phone };
    return true;
  }
}
