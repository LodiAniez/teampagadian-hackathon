import { Inject, Injectable, Logger } from "@nestjs/common";
import { Prisma, type Payment } from "@prisma/client";
import { erc20Abi, parseAbiItem, parseUnits, type Hex } from "viem";
import { PrismaService } from "../../common/prisma/prisma.service";
import type { MorphPublicClient, MorphWalletClient } from "./morph-clients";
import {
  MORPH_PUBLIC_CLIENT,
  MORPH_WALLET_CLIENT,
  SETTLEMENT_CONFIG,
  SettlementFailedError,
  type SettleArgs,
  type SettlementConfig,
} from "./settlement.types";

// Mock USDC on Morph Hoodi uses 6 decimals (matches real Circle USDC).
const USDC_DECIMALS = 6;

// How many PENDING→SETTLING transitions (i.e. viem attempts) we tolerate
// per PaymentIntent before transitioning to FAILED. Stripe redelivers a
// failed webhook on exponential backoff for up to ~3 days, so 5 attempts
// covers the practical wall-clock retry window without leaving genuinely
// broken payments forever in SETTLING.
const MAX_RETRIES = 5;

// Pre-parsed once — used by getLogs in the balance precheck path. Defining
// it inline at the call site would re-parse the ABI string on every retry.
const TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);

@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(MORPH_WALLET_CLIENT) private readonly walletClient: MorphWalletClient,
    @Inject(MORPH_PUBLIC_CLIENT) private readonly publicClient: MorphPublicClient,
    @Inject(SETTLEMENT_CONFIG) private readonly config: SettlementConfig,
  ) {}

  // Idempotent settlement: signs a USDC.transfer from the hot wallet to the
  // mocked Coins.ph deposit address, waits for the on-chain receipt, then
  // writes the payment row + flips the invoice to PAID in a single Prisma
  // transaction. Safe to call multiple times with the same paymentIntentId
  // — the SETTLED/FAILED early-return + the SETTLING anchor row prevent
  // double on-chain submission. See ticket and the PENDING→SETTLING→SETTLED
  // state-machine diagram on Linear for the full design.
  async settle(args: SettleArgs): Promise<Payment> {
    // ---- Phase A — anchor ----
    const existing = await this.prisma.payment.findUnique({
      where: { stripePaymentIntentId: args.paymentIntentId },
    });

    if (existing?.morphTxStatus === "SETTLED") return existing;
    if (existing?.morphTxStatus === "FAILED") {
      throw new SettlementFailedError(existing.id);
    }

    const payment = existing ? existing : await this.createAnchor(args);

    // Re-check status on the anchor we just created/re-read — a P2002 race
    // could have surfaced a row in SETTLED/FAILED from a concurrent webhook.
    if (payment.morphTxStatus === "SETTLED") return payment;
    if (payment.morphTxStatus === "FAILED") {
      throw new SettlementFailedError(payment.id);
    }

    return this.executeSettlement(payment, args);
  }

  // ---------------- Phase A helpers ----------------

  private async createAnchor(args: SettleArgs): Promise<Payment> {
    const invoice = await this.prisma.invoice.findUniqueOrThrow({
      where: { id: args.invoiceId },
      select: { userId: true },
    });
    const blockNumber = await this.publicClient.getBlockNumber();

    try {
      return await this.prisma.payment.create({
        data: {
          invoiceId: args.invoiceId,
          userId: invoice.userId,
          stripePaymentIntentId: args.paymentIntentId,
          stripeChargeId: args.stripeChargeId,
          amountReceived: new Prisma.Decimal(args.amountReceived),
          amountReceivedCurrency: args.amountReceivedCurrency,
          amountPhp: new Prisma.Decimal(args.amountPhp),
          fxRate: new Prisma.Decimal(args.fxRate),
          fxFeeAmount: new Prisma.Decimal(args.fxFeeAmount),
          fxFeePercent: new Prisma.Decimal(args.fxFeePercent),
          morphTxStatus: "PENDING",
          morphRetryCount: 0,
          morphAnchorBlock: blockNumber,
          paidAt: args.paidAt,
        },
      });
    } catch (err) {
      // P2002 = unique constraint violation. A concurrent webhook delivery
      // raced us and inserted the row first. Re-read and let the caller
      // continue from whatever state that row is now in.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return this.prisma.payment.findUniqueOrThrow({
          where: { stripePaymentIntentId: args.paymentIntentId },
        });
      }
      throw err;
    }
  }

  // ---------------- Phase B + Phase C ----------------

  private async executeSettlement(payment: Payment, args: SettleArgs): Promise<Payment> {
    if (payment.morphRetryCount >= MAX_RETRIES) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { morphTxStatus: "FAILED" },
      });
      throw new SettlementFailedError(
        payment.id,
        `Settlement exhausted ${MAX_RETRIES} retries for payment ${payment.id}; transitioned to FAILED`,
      );
    }

    // Transition PENDING/SETTLING → SETTLING + bump retry count. This must
    // run BEFORE the on-chain submission so the row is visible to the
    // retry sweep (which targets `morphTxStatus = SETTLING`) if the
    // process dies mid-transfer.
    const transitioned = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        morphTxStatus: "SETTLING",
        morphRetryCount: { increment: 1 },
      },
    });

    const expectedUnits = parseUnits(args.amountReceived.toString(), USDC_DECIMALS);

    // Balance precheck: only on a retry (just-incremented count > 1 means
    // we've been here before). Scans Transfer events from the anchor block
    // — if a prior attempt landed on-chain but the DB write was lost, we
    // adopt the orphaned hash instead of re-submitting and double-paying.
    if (transitioned.morphRetryCount > 1 && transitioned.morphAnchorBlock !== null) {
      const adopted = await this.findOrphanedTransfer(expectedUnits, transitioned.morphAnchorBlock);
      if (adopted) {
        this.logger.warn(
          `Adopted orphaned tx ${adopted} for payment ${payment.id} (retry #${transitioned.morphRetryCount}); a prior attempt landed without DB confirmation`,
        );
        return this.transitionToSettled(payment.id, args.invoiceId, adopted);
      }
    }

    // Submit on-chain. Throw propagates up: row stays SETTLING with the
    // incremented retry count, Stripe redelivers, next attempt resumes.
    const txHash = await this.walletClient.writeContract({
      address: this.config.usdcContract,
      abi: erc20Abi,
      functionName: "transfer",
      args: [this.config.coinsphDeposit, expectedUnits],
      account: this.walletClient.account,
      chain: this.walletClient.chain,
    });
    await this.publicClient.waitForTransactionReceipt({ hash: txHash });

    return this.transitionToSettled(payment.id, args.invoiceId, txHash);
  }

  private async findOrphanedTransfer(
    expectedUnits: bigint,
    fromBlock: bigint,
  ): Promise<Hex | null> {
    const logs = await this.publicClient.getLogs({
      address: this.config.usdcContract,
      event: TRANSFER_EVENT,
      args: {
        from: this.config.hotWalletAddress,
        to: this.config.coinsphDeposit,
      },
      fromBlock,
      toBlock: "latest",
    });
    const matching = logs.find((l) => l.args.value === expectedUnits);
    return matching ? matching.transactionHash : null;
  }

  // ---------------- Phase C ----------------

  private async transitionToSettled(
    paymentId: string,
    invoiceId: string,
    txHash: Hex,
  ): Promise<Payment> {
    const [payment] = await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: paymentId },
        data: { morphTxStatus: "SETTLED", morphTxHash: txHash },
      }),
      this.prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: "paid" },
      }),
    ]);
    return payment;
  }
}
