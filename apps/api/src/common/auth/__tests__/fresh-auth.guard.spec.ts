import { describe, it, expect, beforeEach, vi } from "vitest";
import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  SignJWT,
  generateKeyPair,
  exportJWK,
  createLocalJWKSet,
  createRemoteJWKSet,
  type CryptoKey,
  type JWK,
} from "jose";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import type { User as PrismaUser } from "@prisma/client";
import { FreshAuthGuard } from "../fresh-auth.guard";
import { PrismaService } from "../../prisma/prisma.service";
import type { EnvConfig } from "../../config/env.schema";
import type { AuthedRequest } from "../auth-user.types";
import type { ExecutionContext } from "@nestjs/common";

vi.mock("jose", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jose")>();
  return { ...actual, createRemoteJWKSet: vi.fn() };
});

const SUPABASE_URL = "https://test-project.supabase.co";
const ISSUER = "https://test-project.supabase.co/auth/v1";
const PHONE = "+639171234567";
const SUPABASE_USER_ID = "11111111-1111-1111-1111-111111111111";
const LOCAL_USER_ID = "22222222-2222-2222-2222-222222222222";

let privateKey: CryptoKey;
let publicJwk: JWK;

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

async function makeToken(
  overrides: {
    amr?: Array<{ method: string; timestamp: number }>;
    omitAmr?: boolean;
  } = {},
): Promise<string> {
  const claims: Record<string, unknown> = { phone: PHONE };
  if (!overrides.omitAmr) {
    claims.amr = overrides.amr ?? [{ method: "otp", timestamp: nowSec() }];
  }

  return new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: "test-kid" })
    .setSubject(SUPABASE_USER_ID)
    .setAudience("authenticated")
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(nowSec() + 3600)
    .sign(privateKey);
}

function buildContext(authorization?: string): {
  ctx: ExecutionContext;
  req: Partial<AuthedRequest>;
} {
  const headers: Record<string, string> = {};
  if (authorization !== undefined) headers.authorization = authorization;
  const req: Partial<AuthedRequest> = { headers };
  const ctx = {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => undefined,
      getNext: () => undefined,
    }),
  } as Partial<ExecutionContext> as ExecutionContext;
  return { ctx, req };
}

function buildLocalUser(): PrismaUser {
  return {
    id: LOCAL_USER_ID,
    supabaseUserId: SUPABASE_USER_ID,
    phone: PHONE,
    name: null,
    businessName: null,
    defaultCurrency: "USD",
    defaultHourlyRate: null,
    bir2303Election: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("FreshAuthGuard", () => {
  let guard: FreshAuthGuard;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    const keyPair = await generateKeyPair("RS256");
    privateKey = keyPair.privateKey;
    publicJwk = await exportJWK(keyPair.publicKey);
    publicJwk.kid = "test-kid";
    publicJwk.alg = "RS256";

    const localJwks = createLocalJWKSet({ keys: [publicJwk] });
    const remoteShim: ReturnType<typeof createRemoteJWKSet> = Object.assign(
      (...args: Parameters<typeof localJwks>) => localJwks(...args),
      {
        coolingDown: false,
        fresh: true,
        reloading: false,
        reload: async () => undefined,
        jwks: () => ({ keys: [publicJwk] }),
      },
    );
    vi.mocked(createRemoteJWKSet).mockReturnValue(remoteShim);

    prisma = mockDeep<PrismaService>();
    const configMock = mockDeep<ConfigService<EnvConfig, true>>();
    configMock.get.mockImplementation(((key: keyof EnvConfig) => {
      if (key === "SUPABASE_URL") return SUPABASE_URL;
      if (key === "FRESH_AUTH_MAX_AGE_SECONDS") return 300;
      return undefined;
    }) as never);

    guard = new FreshAuthGuard(prisma, configMock);
    prisma.user.findUnique.mockResolvedValue(buildLocalUser());
  });

  it("rejects when Authorization header is missing", async () => {
    const { ctx } = buildContext();
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it("rejects when amr claim is missing", async () => {
    const token = await makeToken({ omitAmr: true });
    const { ctx } = buildContext(`Bearer ${token}`);
    await expect(guard.canActivate(ctx)).rejects.toThrow("Token missing amr claim");
  });

  it("rejects when authentication happened more than 300 seconds ago", async () => {
    const token = await makeToken({
      amr: [{ method: "otp", timestamp: nowSec() - 301 }],
    });
    const { ctx } = buildContext(`Bearer ${token}`);
    await expect(guard.canActivate(ctx)).rejects.toThrow("Token is not fresh");
  });

  it("allows a token authenticated within the freshness window", async () => {
    const token = await makeToken({
      amr: [{ method: "otp", timestamp: nowSec() - 60 }],
    });
    const { ctx, req } = buildContext(`Bearer ${token}`);

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(req.user).toEqual({ id: LOCAL_USER_ID, phone: PHONE });
  });

  it("allows authentication at exactly 299 seconds ago (within window)", async () => {
    const token = await makeToken({
      amr: [{ method: "otp", timestamp: nowSec() - 299 }],
    });
    const { ctx } = buildContext(`Bearer ${token}`);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it("rejects at exactly 301 seconds ago (outside window)", async () => {
    const token = await makeToken({
      amr: [{ method: "otp", timestamp: nowSec() - 301 }],
    });
    const { ctx } = buildContext(`Bearer ${token}`);
    await expect(guard.canActivate(ctx)).rejects.toThrow("Token is not fresh");
  });

  it("uses the latest amr entry when multiple methods exist", async () => {
    const token = await makeToken({
      amr: [
        { method: "otp", timestamp: nowSec() - 600 },
        { method: "otp", timestamp: nowSec() - 30 },
      ],
    });
    const { ctx } = buildContext(`Bearer ${token}`);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it("rejects a silently refreshed token whose amr is stale", async () => {
    const token = await makeToken({
      amr: [{ method: "otp", timestamp: nowSec() - 600 }],
    });
    const { ctx } = buildContext(`Bearer ${token}`);
    await expect(guard.canActivate(ctx)).rejects.toThrow("Token is not fresh");
  });
});
