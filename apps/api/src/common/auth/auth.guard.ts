import {
  CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { EnvConfig } from "../config/env.schema";
import type { AuthedRequest } from "./auth-user.types";

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly supabase: SupabaseClient;

  constructor(config: ConfigService<EnvConfig, true>) {
    this.supabase = createClient(
      config.get("SUPABASE_URL", { infer: true }),
      config.get("SUPABASE_SERVICE_ROLE_KEY", { infer: true }),
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing or malformed Authorization header");
    }

    const token = header.slice("Bearer ".length);
    const { data, error } = await this.supabase.auth.getUser(token);

    if (error || !data.user) {
      throw new UnauthorizedException("Invalid or expired token");
    }

    req.user = {
      id: data.user.id,
      phone: data.user.phone ?? null,
    };

    return true;
  }
}
