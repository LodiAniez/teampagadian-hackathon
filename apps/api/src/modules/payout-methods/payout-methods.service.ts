import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type PayoutMethod as PayoutMethodRow } from "@prisma/client";
import type {
  AddPayoutMethodBody,
  PayoutMethod,
  PayoutMethodType,
  SetupIntentResponse,
} from "@raket/contracts";
import { PrismaService } from "../../common/prisma/prisma.service";
import { StripeService } from "../integrations/stripe/stripe.service";
import { toPayoutMethodDto, CONTRACT_TO_PRISMA_TYPE } from "./payout-methods.mapper";

@Injectable()
export class PayoutMethodsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
  ) {}

  async createSetupIntent(userId: string): Promise<SetupIntentResponse> {
    return this.stripeService.createSetupIntent(userId);
  }

  async list(userId: string): Promise<PayoutMethod[]> {
    const rows = await this.prisma.payoutMethod.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toPayoutMethodDto);
  }

  async add(userId: string, body: AddPayoutMethodBody): Promise<PayoutMethod> {
    let details: Prisma.InputJsonObject;

    if (body.type === "card") {
      details = await this.stripeService.retrieveCardDetails(body.stripePaymentMethodId);
    } else if (body.type === "gcash") {
      // Non-card types trust client-supplied fields — freelancer self-reports
      // their own payout destination. Server-side verification would require
      // GCash/Maya/bank partner APIs (out of hackathon scope).
      details = { phoneNumber: body.phoneNumber, accountName: body.accountName };
    } else if (body.type === "maya") {
      details = { phoneNumber: body.phoneNumber, accountName: body.accountName };
    } else {
      details = {
        bankName: body.bankName,
        accountNumberLast4: body.accountNumberLast4,
        accountName: body.accountName,
      };
    }

    const created = await this.addInSerializableTxn(userId, body.type, details);

    return toPayoutMethodDto(created);
  }

  async setDefault(userId: string, id: string): Promise<PayoutMethod> {
    const updated = await this.setDefaultInSerializableTxn(userId, id);
    return toPayoutMethodDto(updated);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const target = await tx.payoutMethod.findFirst({ where: { id, userId } });
      if (!target) throw new NotFoundException(`Payout method ${id} not found`);

      if (target.isDefault) {
        const next = await tx.payoutMethod.findFirst({
          where: { userId, id: { not: id } },
          orderBy: { createdAt: "asc" },
        });
        if (next) {
          await tx.payoutMethod.update({
            where: { id: next.id },
            data: { isDefault: true },
          });
        }
      }
      await tx.payoutMethod.delete({ where: { id, userId } });
    });
  }

  private async setDefaultInSerializableTxn(
    userId: string,
    id: string,
    retried = false,
  ): Promise<PayoutMethodRow> {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const target = await tx.payoutMethod.findFirst({ where: { id, userId } });
          if (!target) throw new NotFoundException(`Payout method ${id} not found`);
          if (target.isDefault) return target;

          await tx.payoutMethod.updateMany({
            where: { userId, isDefault: true },
            data: { isDefault: false },
          });
          return tx.payoutMethod.update({
            where: { id, userId },
            data: { isDefault: true },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (err) {
      if (!retried && err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034") {
        return this.setDefaultInSerializableTxn(userId, id, true);
      }
      throw err;
    }
  }

  private async addInSerializableTxn(
    userId: string,
    type: PayoutMethodType,
    details: Prisma.InputJsonObject,
    retried = false,
  ): Promise<PayoutMethodRow> {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const existingCount = await tx.payoutMethod.count({ where: { userId } });
          return tx.payoutMethod.create({
            data: {
              userId,
              type: CONTRACT_TO_PRISMA_TYPE[type],
              details,
              isDefault: existingCount === 0,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (err) {
      if (!retried && err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034") {
        return this.addInSerializableTxn(userId, type, details, true);
      }
      throw err;
    }
  }
}
