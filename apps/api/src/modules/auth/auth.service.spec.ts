import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import { UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcrypt";
import type { User as PrismaUser } from "@prisma/client";
import { AuthService } from "./auth.service";
import { PrismaService } from "../../common/prisma/prisma.service";
import type { EnvConfig } from "../../common/config/env.schema";

// Auto-mock bcrypt; cast helpers to the Promise overloads to avoid TypeScript
// picking the void callback overload as the inferred return type.
vi.mock("bcrypt", () => ({ hash: vi.fn(), compare: vi.fn(), genSalt: vi.fn() }));

type HashFn = (data: string | Buffer, saltOrRounds: string | number) => Promise<string>;
type CompareFn = (data: string | Buffer, encrypted: string) => Promise<boolean>;

describe("AuthService", () => {
  let service: AuthService;
  let prisma: DeepMockProxy<PrismaService>;
  let jwtMock: DeepMockProxy<JwtService>;
  let configMock: DeepMockProxy<ConfigService<EnvConfig, true>>;
  let mockHash: Mock<HashFn>;
  let mockCompare: Mock<CompareFn>;

  const phone = "+639171234567";
  const code = "123456";
  const futureDate = new Date(Date.now() + 300_000);

  const mockOtp = {
    id: "otp-id",
    phone,
    codeHash: "hashed",
    expiresAt: futureDate,
    consumedAt: null,
    attempts: 0,
    createdAt: new Date(),
  };

  const mockUser: PrismaUser = {
    id: "user-id",
    phone,
    name: null,
    businessName: null,
    defaultCurrency: "USD",
    defaultHourlyRate: null,
    bir2303Election: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    jwtMock = mockDeep<JwtService>();
    configMock = mockDeep<ConfigService<EnvConfig, true>>();

    mockHash = vi.mocked(bcrypt.hash) as Mock<HashFn>;
    mockCompare = vi.mocked(bcrypt.compare) as Mock<CompareFn>;

    jwtMock.sign.mockReturnValue("mock-token");
    configMock.get.mockReturnValue("development" as never);

    service = new AuthService(prisma, jwtMock, configMock);
  });

  describe("requestOtp", () => {
    it("creates an OtpChallenge and returns success with devOtpCode in non-prod", async () => {
      mockHash.mockResolvedValue("hashed-code");
      prisma.otpChallenge.create.mockResolvedValue(mockOtp);

      const result = await service.requestOtp({ phone });

      expect(prisma.otpChallenge.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ phone }),
        }),
      );
      expect(result.success).toBe(true);
      expect(result.expiresInSeconds).toBe(300);
      expect(result.devOtpCode).toMatch(/^\d{6}$/);
    });

    it("omits devOtpCode when NODE_ENV is production", async () => {
      const prodConfig = mockDeep<ConfigService<EnvConfig, true>>();
      prodConfig.get.mockReturnValue("production" as never);
      const prodService = new AuthService(prisma, jwtMock, prodConfig);

      mockHash.mockResolvedValue("hashed-code");
      prisma.otpChallenge.create.mockResolvedValue(mockOtp);

      const result = await prodService.requestOtp({ phone });

      expect(result.devOtpCode).toBeUndefined();
    });
  });

  describe("verifyOtp", () => {
    it("returns user, accessToken, and isNewUser=true for a new user with valid code", async () => {
      prisma.otpChallenge.findFirst.mockResolvedValue(mockOtp);
      mockCompare.mockResolvedValue(true);
      prisma.otpChallenge.update.mockResolvedValue(mockOtp);
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.upsert.mockResolvedValue(mockUser);

      const result = await service.verifyOtp({ phone, code });

      expect(result.accessToken).toBe("mock-token");
      expect(result.isNewUser).toBe(true);
      expect(result.user.id).toBe("user-id");
    });

    it("returns isNewUser=false for an existing user", async () => {
      prisma.otpChallenge.findFirst.mockResolvedValue(mockOtp);
      mockCompare.mockResolvedValue(true);
      prisma.otpChallenge.update.mockResolvedValue(mockOtp);
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.upsert.mockResolvedValue(mockUser);

      const result = await service.verifyOtp({ phone, code });

      expect(result.isNewUser).toBe(false);
    });

    it("throws when no active OTP exists", async () => {
      prisma.otpChallenge.findFirst.mockResolvedValue(null);

      await expect(service.verifyOtp({ phone, code })).rejects.toThrow(
        new UnauthorizedException("No active OTP"),
      );
    });

    it("throws when OTP is expired", async () => {
      prisma.otpChallenge.findFirst.mockResolvedValue({
        ...mockOtp,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.verifyOtp({ phone, code })).rejects.toThrow(
        new UnauthorizedException("Expired"),
      );
    });

    it("throws when attempts >= 5", async () => {
      prisma.otpChallenge.findFirst.mockResolvedValue({ ...mockOtp, attempts: 5 });

      await expect(service.verifyOtp({ phone, code })).rejects.toThrow(
        new UnauthorizedException("Too many attempts"),
      );
    });

    it("throws and increments attempts on invalid code", async () => {
      prisma.otpChallenge.findFirst.mockResolvedValue(mockOtp);
      mockCompare.mockResolvedValue(false);
      prisma.otpChallenge.update.mockResolvedValue(mockOtp);

      await expect(service.verifyOtp({ phone, code })).rejects.toThrow(
        new UnauthorizedException("Invalid code"),
      );

      expect(prisma.otpChallenge.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ attempts: { increment: 1 } }),
        }),
      );
    });
  });
});
