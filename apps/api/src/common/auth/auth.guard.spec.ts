import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
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
import type { User as PrismaUser } from "@prisma/client";
import { AuthGuard } from "./auth.guard";
import { PrismaService } from "../prisma/prisma.service";
import type { EnvConfig } from "../config/env.schema";
import type { AuthedRequest } from "./auth-user.types";

vi.mock("jose", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jose")>();
  return {
    ...actual,
    createRemoteJWKSet: vi.fn(),
  };
});

const SUPABASE_URL = "https://test-project.supabase.co";
const ISSUER = "https://test-project.supabase.co/auth/v1";
const PHONE = "+639383673347";
const SUPABASE_USER_ID = "11111111-1111-1111-1111-111111111111";
const LOCAL_USER_ID = "22222222-2222-2222-2222-222222222222";

let privateKey: CryptoKey;
let publicJwk: JWK;

async function makeToken(
  overrides: {
    sub?: string;
    phone?: string;
    audience?: string;
    issuer?: string;
    expSeconds?: number;
    omitSub?: boolean;
    omitPhone?: boolean;
  } = {},
): Promise<string> {
  const sub = overrides.omitSub ? undefined : (overrides.sub ?? SUPABASE_USER_ID);
  const claims: Record<string, unknown> = {};
  if (!overrides.omitPhone) claims.phone = overrides.phone ?? PHONE;

  let builder = new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: "test-kid" })
    .setAudience(overrides.audience ?? "authenticated")
    .setIssuer(overrides.issuer ?? ISSUER)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + (overrides.expSeconds ?? 3600));

  if (sub) builder = builder.setSubject(sub);

  return builder.sign(privateKey);
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

function buildLocalUser(overrides: Partial<PrismaUser> = {}): PrismaUser {
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
    ...overrides,
  };
}

describe("AuthGuard", () => {
  let guard: AuthGuard;
  let prisma: DeepMockProxy<PrismaService>;
  let configMock: DeepMockProxy<ConfigService<EnvConfig, true>>;

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
    configMock = mockDeep<ConfigService<EnvConfig, true>>();
    configMock.get.mockImplementation(((key: keyof EnvConfig) => {
      if (key === "SUPABASE_URL") return SUPABASE_URL;
      return undefined;
    }) as never);

    guard = new AuthGuard(prisma, configMock);
  });

  describe("header validation", () => {
    it("throws when the Authorization header is missing", async () => {
      const { ctx } = buildContext();
      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });

    it("throws when the Authorization header does not start with Bearer", async () => {
      const { ctx } = buildContext("Basic abc");
      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("JWT verification", () => {
    it("throws on an expired token", async () => {
      const token = await makeToken({ expSeconds: -10 });
      const { ctx } = buildContext(`Bearer ${token}`);
      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });

    it("throws on a token with the wrong issuer", async () => {
      const token = await makeToken({ issuer: "https://other.supabase.co/auth/v1" });
      const { ctx } = buildContext(`Bearer ${token}`);
      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });

    it("throws on a token with the wrong audience", async () => {
      const token = await makeToken({ audience: "anon" });
      const { ctx } = buildContext(`Bearer ${token}`);
      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });

    it("throws on a token signed with a different key", async () => {
      const other = await generateKeyPair("RS256");
      const token = await new SignJWT({ phone: PHONE })
        .setProtectedHeader({ alg: "RS256", kid: "test-kid" })
        .setSubject(SUPABASE_USER_ID)
        .setAudience("authenticated")
        .setIssuer(ISSUER)
        .setIssuedAt()
        .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
        .sign(other.privateKey);

      const { ctx } = buildContext(`Bearer ${token}`);
      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });

    it("throws when sub claim is missing", async () => {
      const token = await makeToken({ omitSub: true });
      const { ctx } = buildContext(`Bearer ${token}`);
      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });

    it("throws when phone claim is missing", async () => {
      const token = await makeToken({ omitPhone: true });
      const { ctx } = buildContext(`Bearer ${token}`);
      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("user bridge", () => {
    it("resolves the existing user when supabaseUserId is already linked", async () => {
      const existing = buildLocalUser();
      prisma.user.findUnique.mockResolvedValueOnce(existing);

      const token = await makeToken();
      const { ctx, req } = buildContext(`Bearer ${token}`);

      await expect(guard.canActivate(ctx)).resolves.toBe(true);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { supabaseUserId: SUPABASE_USER_ID },
      });
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(req.user).toEqual({ id: LOCAL_USER_ID, phone: PHONE });
    });

    it("links supabaseUserId onto an existing phone-matched user", async () => {
      const existingByPhone = buildLocalUser({ supabaseUserId: null });
      prisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(existingByPhone);
      prisma.user.update.mockResolvedValueOnce(
        buildLocalUser({ supabaseUserId: SUPABASE_USER_ID }),
      );

      const token = await makeToken();
      const { ctx } = buildContext(`Bearer ${token}`);

      await expect(guard.canActivate(ctx)).resolves.toBe(true);

      expect(prisma.user.findUnique).toHaveBeenNthCalledWith(1, {
        where: { supabaseUserId: SUPABASE_USER_ID },
      });
      expect(prisma.user.findUnique).toHaveBeenNthCalledWith(2, {
        where: { phone: PHONE },
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: LOCAL_USER_ID },
        data: { supabaseUserId: SUPABASE_USER_ID },
      });
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it("creates a new local user when neither supabaseUserId nor phone match", async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      prisma.user.create.mockResolvedValueOnce(buildLocalUser());

      const token = await makeToken();
      const { ctx, req } = buildContext(`Bearer ${token}`);

      await expect(guard.canActivate(ctx)).resolves.toBe(true);

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: { supabaseUserId: SUPABASE_USER_ID, phone: PHONE },
      });
      expect(req.user).toEqual({ id: LOCAL_USER_ID, phone: PHONE });
    });
  });
});
