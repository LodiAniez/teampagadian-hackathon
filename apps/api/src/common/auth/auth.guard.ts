import {
  CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { AuthSession } from "@raket/contracts";
import type { AuthedRequest } from "./auth-user.types";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization;

    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing or malformed Authorization header");
    }

    const token = header.slice("Bearer ".length);
    let payload: AuthSession;
    try {
      payload = this.jwt.verify<AuthSession>(token);
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }

    req.user = { id: payload.userId, phone: payload.phone };
    return true;
  }
}
