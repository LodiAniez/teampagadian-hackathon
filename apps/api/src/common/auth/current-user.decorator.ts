import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { AuthUser, AuthedRequest } from "./auth-user.types";

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    if (!req.user) {
      throw new Error("CurrentUser used without AuthGuard");
    }
    return req.user;
  },
);
