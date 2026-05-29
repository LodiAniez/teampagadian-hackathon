import { Injectable, Logger } from "@nestjs/common";
import { Prisma, type Payout } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import { generateMockTxnId } from "./payouts.types";

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async disburseToFreelancer(paymentId: string): Promise<Payout | null> {
    const payment = await this.prisma.payment.findUniqueOrThrow({
      where: { id: paymentId },
    });

    const payoutMethod = await this.prisma.payoutMethod.findFirst({
      where: { userId: payment.userId, isDefault: true },
    });

    if (!payoutMethod) {
      this.logger.warn(
        `No default payout method for user ${payment.userId}; skipping payout for payment ${paymentId}`,
      );
      return null;
    }

    // Demo realism: simulate a 1–2 s disbursement latency so the mobile
    // "money landed" toast doesn't fire instantly during the demo.
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 1000 + Math.random() * 1000);
    });

    const externalTxnId = generateMockTxnId(payoutMethod.type);

    try {
      return await this.prisma.payout.create({
        data: {
          paymentId,
          payoutMethodId: payoutMethod.id,
          amountPhp: payment.amountPhp,
          status: "DELIVERED",
          externalTxnId,
          completedAt: new Date(),
        },
      });
    } catch (err) {
      // P2002 on Payout.paymentId @unique — a duplicate Stripe webhook
      // delivery raced us. Return the existing row so the webhook stays
      // 2xx; otherwise Stripe retries forever.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return this.prisma.payout.findUniqueOrThrow({ where: { paymentId } });
      }
      throw err;
    }
  }
}
