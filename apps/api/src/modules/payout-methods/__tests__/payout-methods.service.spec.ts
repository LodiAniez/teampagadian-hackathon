import { describe, it, expect, beforeEach } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import { NotFoundException } from "@nestjs/common";
import { Prisma, PayoutMethodType } from "@prisma/client";
import type { PayoutMethod as PayoutMethodRow } from "@prisma/client";
import { PayoutMethodsService } from "../payout-methods.service";
import { PrismaService } from "../../../common/prisma/prisma.service";
import { StripeService } from "../../integrations/stripe/stripe.service";

const now = new Date();

function makeRow(overrides: Partial<PayoutMethodRow> = {}): PayoutMethodRow {
  return {
    id: "pm-id",
    userId: "user-id",
    type: PayoutMethodType.CARD,
    details: {
      brand: "visa",
      last4: "4242",
      expMonth: 12,
      expYear: 2030,
      stripePaymentMethodId: "pm_stripe123",
    },
    isDefault: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("PayoutMethodsService", () => {
  let service: PayoutMethodsService;
  let prisma: DeepMockProxy<PrismaService>;
  let stripeService: DeepMockProxy<StripeService>;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    stripeService = mockDeep<StripeService>();
    service = new PayoutMethodsService(prisma, stripeService);
  });

  describe("list", () => {
    it("returns empty array when user has no payout methods", async () => {
      prisma.payoutMethod.findMany.mockResolvedValue([]);
      const result = await service.list("user-id");
      expect(result).toEqual([]);
    });

    it("returns mapped payout methods ordered by createdAt asc", async () => {
      const row = makeRow({ isDefault: true });
      prisma.payoutMethod.findMany.mockResolvedValue([row]);

      const result = await service.list("user-id");

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("pm-id");
      expect(result[0].type).toBe("card");
      expect(result[0].isDefault).toBe(true);
      expect(prisma.payoutMethod.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: "user-id" }, orderBy: { createdAt: "asc" } }),
      );
    });
  });

  describe("add", () => {
    beforeEach(() => {
      prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
    });

    it("creates a card method using Stripe-retrieved details", async () => {
      const cardDetails = {
        brand: "visa",
        last4: "4242",
        expMonth: 12,
        expYear: 2030,
        stripePaymentMethodId: "pm_abc",
      };
      stripeService.retrieveCardDetails.mockResolvedValue(cardDetails);
      prisma.payoutMethod.count.mockResolvedValue(1);
      const created = makeRow({ details: cardDetails, isDefault: false });
      prisma.payoutMethod.create.mockResolvedValue(created);

      const result = await service.add("user-id", {
        type: "card",
        stripePaymentMethodId: "pm_abc",
      });

      expect(stripeService.retrieveCardDetails).toHaveBeenCalledWith("pm_abc");
      expect(prisma.payoutMethod.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: PayoutMethodType.CARD,
            details: cardDetails,
            isDefault: false,
          }),
        }),
      );
      expect(result.type).toBe("card");
    });

    it("auto-sets isDefault=true for the first payout method", async () => {
      const cardDetails = {
        brand: "mastercard",
        last4: "1234",
        expMonth: 6,
        expYear: 2028,
        stripePaymentMethodId: "pm_first",
      };
      stripeService.retrieveCardDetails.mockResolvedValue(cardDetails);
      prisma.payoutMethod.count.mockResolvedValue(0);
      prisma.payoutMethod.create.mockResolvedValue(makeRow({ isDefault: true }));

      await service.add("user-id", {
        type: "card",
        stripePaymentMethodId: "pm_first",
      });

      expect(prisma.payoutMethod.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isDefault: true }),
        }),
      );
    });

    it("creates a GCash method without calling Stripe", async () => {
      prisma.payoutMethod.count.mockResolvedValue(1);
      prisma.payoutMethod.create.mockResolvedValue(
        makeRow({
          type: PayoutMethodType.GCASH,
          details: { phoneNumber: "+639171234567", accountName: "Juan" },
        }),
      );

      await service.add("user-id", {
        type: "gcash",
        phoneNumber: "+639171234567",
        accountName: "Juan",
      });

      expect(stripeService.retrieveCardDetails).not.toHaveBeenCalled();
      expect(prisma.payoutMethod.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: PayoutMethodType.GCASH }),
        }),
      );
    });

    it("wraps count + create in a serializable transaction", async () => {
      prisma.payoutMethod.count.mockResolvedValue(1);
      prisma.payoutMethod.create.mockResolvedValue(makeRow({ isDefault: false }));

      await service.add("user-id", {
        type: "gcash",
        phoneNumber: "+639171234567",
        accountName: "Juan",
      });

      expect(prisma.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ isolationLevel: "Serializable" }),
      );
    });

    it("retries once on serialization conflict (P2034)", async () => {
      prisma.$transaction
        .mockRejectedValueOnce(
          new Prisma.PrismaClientKnownRequestError("serialization failure", {
            code: "P2034",
            clientVersion: "test",
          }),
        )
        .mockImplementation(async (fn) => fn(prisma));
      prisma.payoutMethod.count.mockResolvedValue(1);
      prisma.payoutMethod.create.mockResolvedValue(makeRow({ isDefault: false }));

      await service.add("user-id", {
        type: "gcash",
        phoneNumber: "+639171234567",
        accountName: "Juan",
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    });

    it("throws on a second serialization conflict (no infinite retry)", async () => {
      prisma.$transaction.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("serialization failure", {
          code: "P2034",
          clientVersion: "test",
        }),
      );

      await expect(
        service.add("user-id", {
          type: "gcash",
          phoneNumber: "+639171234567",
          accountName: "Juan",
        }),
      ).rejects.toThrow("serialization failure");

      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    });
  });

  describe("setDefault", () => {
    beforeEach(() => {
      prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
    });

    it("throws NotFoundException when method does not belong to the user", async () => {
      prisma.payoutMethod.findFirst.mockResolvedValue(null);

      await expect(service.setDefault("user-id", "pm-id")).rejects.toThrow(NotFoundException);
    });

    it("short-circuits when the target is already the default", async () => {
      prisma.payoutMethod.findFirst.mockResolvedValue(makeRow({ isDefault: true }));

      const result = await service.setDefault("user-id", "pm-id");

      expect(result.isDefault).toBe(true);
      expect(prisma.payoutMethod.updateMany).not.toHaveBeenCalled();
    });

    it("unsets all existing defaults and sets the target as default in a transaction", async () => {
      prisma.payoutMethod.findFirst.mockResolvedValue(makeRow({ isDefault: false }));
      prisma.payoutMethod.updateMany.mockResolvedValue({ count: 1 });
      prisma.payoutMethod.update.mockResolvedValue(makeRow({ isDefault: true }));

      const result = await service.setDefault("user-id", "pm-id");

      expect(prisma.payoutMethod.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "user-id", isDefault: true },
          data: { isDefault: false },
        }),
      );
      expect(prisma.payoutMethod.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "pm-id", userId: "user-id" },
          data: { isDefault: true },
        }),
      );
      expect(result.isDefault).toBe(true);
    });

    it("uses Serializable isolation and retries on P2034", async () => {
      prisma.$transaction
        .mockRejectedValueOnce(
          new Prisma.PrismaClientKnownRequestError("serialization failure", {
            code: "P2034",
            clientVersion: "test",
          }),
        )
        .mockImplementation(async (fn) => fn(prisma));
      prisma.payoutMethod.findFirst.mockResolvedValue(makeRow({ isDefault: false }));
      prisma.payoutMethod.updateMany.mockResolvedValue({ count: 1 });
      prisma.payoutMethod.update.mockResolvedValue(makeRow({ isDefault: true }));

      await service.setDefault("user-id", "pm-id");

      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
      expect(prisma.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ isolationLevel: "Serializable" }),
      );
    });
  });

  describe("remove", () => {
    beforeEach(() => {
      prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
    });

    it("throws NotFoundException when method does not belong to the user", async () => {
      prisma.payoutMethod.findFirst.mockResolvedValue(null);

      await expect(service.remove("user-id", "pm-id")).rejects.toThrow(NotFoundException);
    });

    it("deletes a non-default method in a transaction", async () => {
      prisma.payoutMethod.findFirst.mockResolvedValue(makeRow({ isDefault: false }));
      prisma.payoutMethod.delete.mockResolvedValue(makeRow());

      await service.remove("user-id", "pm-id");

      expect(prisma.payoutMethod.delete).toHaveBeenCalledWith({
        where: { id: "pm-id", userId: "user-id" },
      });
    });

    it("auto-promotes another method and deletes the default in a transaction", async () => {
      const next = makeRow({ id: "pm-next", isDefault: false });
      prisma.payoutMethod.findFirst
        .mockResolvedValueOnce(makeRow({ isDefault: true }))
        .mockResolvedValueOnce(next);
      prisma.payoutMethod.update.mockResolvedValue({ ...next, isDefault: true });
      prisma.payoutMethod.delete.mockResolvedValue(makeRow());

      await service.remove("user-id", "pm-id");

      expect(prisma.payoutMethod.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "pm-next" }, data: { isDefault: true } }),
      );
      expect(prisma.payoutMethod.delete).toHaveBeenCalledWith({
        where: { id: "pm-id", userId: "user-id" },
      });
    });

    it("deletes the default without promoting when it is the only method", async () => {
      prisma.payoutMethod.findFirst
        .mockResolvedValueOnce(makeRow({ isDefault: true }))
        .mockResolvedValueOnce(null);
      prisma.payoutMethod.delete.mockResolvedValue(makeRow());

      await service.remove("user-id", "pm-id");

      expect(prisma.payoutMethod.update).not.toHaveBeenCalled();
      expect(prisma.payoutMethod.delete).toHaveBeenCalledWith({
        where: { id: "pm-id", userId: "user-id" },
      });
    });
  });
});
