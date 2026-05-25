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
import { AmrSchema, type AuthedRequest, type VerifiedPayload } from "./auth-user.types";

@Injectable()
export class AuthGuard implements CanActivate {
  protected readonly logger = new Logger(AuthGuard.name);
  protected readonly jwks: JWTVerifyGetKey;
  protected readonly issuer: string;

  constructor(
    protected readonly prisma: PrismaService,
    config: ConfigService<EnvConfig, true>,
  ) {
    const supabaseUrl = config.get("SUPABASE_URL", { infer: true });
    this.jwks = createRemoteJWKSet(new URL("/auth/v1/.well-known/jwks.json", supabaseUrl));
    this.issuer = new URL("/auth/v1", supabaseUrl).toString();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const token = this.extractBearerToken(req);
    const payload = await this.verifyToken(token);
    const user = await this.resolveUser(payload.sub, payload.phone);
    req.user = { id: user.id, phone: payload.phone };
    return true;
  }

  protected extractBearerToken(req: AuthedRequest): string {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing or malformed Authorization header");
    }
    return header.slice("Bearer ".length);
  }

  protected async verifyToken(token: string): Promise<VerifiedPayload> {
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
      const amrResult = AmrSchema.safeParse(payload.amr);
      return {
        sub: payload.sub,
        phone: payload.phone,
        amr: amrResult.success ? amrResult.data : undefined,
      };
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      this.logger.warn(`JWT verification failed: ${err instanceof Error ? err.message : err}`);
      throw new UnauthorizedException("Invalid or expired token");
    }
  }

  protected async resolveUser(supabaseUserId: string, phone: string): Promise<{ id: string }> {
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
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const winner = await this.prisma.user.findUnique({ where: { supabaseUserId } });
        if (winner) return winner;
      }
      throw err;
    }
  }
}
