import { describe, it, expect, beforeEach } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import { NotFoundException } from "@nestjs/common";
import type { User as PrismaUser } from "@prisma/client";
import { AuthService } from "./auth.service";
import { PrismaService } from "../../common/prisma/prisma.service";

describe("AuthService", () => {
  let service: AuthService;
  let prisma: DeepMockProxy<PrismaService>;

  const phone = "+639171234567";

  const mockUser: PrismaUser = {
    id: "user-id",
    supabaseUserId: "11111111-1111-1111-1111-111111111111",
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
    service = new AuthService(prisma);
  });

  describe("me", () => {
    it("returns user DTO for a valid userId", async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.me("user-id");

      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: "user-id" } });
      expect(result.id).toBe("user-id");
      expect(result.phone).toBe(phone);
    });

    it("throws NotFoundException when user does not exist", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.me("unknown-id")).rejects.toThrow(NotFoundException);
    });
  });

  describe("updateProfile", () => {
    it("returns updated user DTO", async () => {
      const updated = { ...mockUser, name: "Juan dela Cruz" };
      prisma.user.update.mockResolvedValue(updated);

      const result = await service.updateProfile("user-id", { name: "Juan dela Cruz" });

      expect(result.name).toBe("Juan dela Cruz");
    });

    it("passes only provided fields to prisma (partial patch)", async () => {
      prisma.user.update.mockResolvedValue(mockUser);

      await service.updateProfile("user-id", { name: "Juan" });

      const call = prisma.user.update.mock.calls[0][0];
      expect(call.data).toHaveProperty("name", "Juan");
      expect(call.data.businessName).toBeUndefined();
      expect(call.data.defaultCurrency).toBeUndefined();
    });

    it("passes bir2303Election through to Prisma unchanged", async () => {
      prisma.user.update.mockResolvedValue({
        ...mockUser,
        bir2303Election: "EIGHT_PERCENT",
      });

      await service.updateProfile("user-id", { bir2303Election: "EIGHT_PERCENT" });

      const call = prisma.user.update.mock.calls[0][0];
      expect(call.data).toHaveProperty("bir2303Election", "EIGHT_PERCENT");
    });
  });
});
