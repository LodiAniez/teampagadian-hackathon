import { Prisma, type Invoice, type Payment } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import type { Hex } from "viem";
import { PrismaService } from "../../common/prisma/prisma.service";
import type { MorphPublicClient, MorphWalletClient } from "./morph-clients";
import { SettlementService } from "./settlement.service";
import { SettlementFailedError, type SettleArgs, type SettlementConfig } from "./settlement.types";

// ---------------- Fixtures ----------------

const USDC_CONTRACT: Hex = "0x1111111111111111111111111111111111111111";
const COINSPH_DEPOSIT: Hex = "0x2222222222222222222222222222222222222222";
const HOT_WALLET_ADDR: Hex = "0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf";
const TX_HASH: Hex = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd";
const ORPHANED_HASH: Hex = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
const HASH_A: Hex = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const HASH_B: Hex = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

const CONFIG: SettlementConfig = {
  usdcContract: USDC_CONTRACT,
  coinsphDeposit: COINSPH_DEPOSIT,
  hotWalletAddress: HOT_WALLET_ADDR,
};

function makeArgs(overrides: Partial<SettleArgs> = {}): SettleArgs {
  return {
    paymentIntentId: "pi_test_123",
    stripeChargeId: "ch_test_123",
    invoiceId: "inv_1",
    amountReceived: 100,
    amountReceivedCurrency: "USD",
    fxRate: 55.0,
    fxFeeAmount: 55.0,
    fxFeePercent: 0.01,
    amountPhp: 5445.0,
    paidAt: new Date("2026-05-27T12:00:00Z"),
    ...overrides,
  };
}

function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "pay_1",
    invoiceId: "inv_1",
    userId: "user_1",
    stripePaymentIntentId: "pi_test_123",
    stripeChargeId: "ch_test_123",
    amountReceived: new Prisma.Decimal("100.00"),
    amountReceivedCurrency: "USD",
    amountPhp: new Prisma.Decimal("5445.00"),
    fxRate: new Prisma.Decimal("55.000000"),
    fxFeeAmount: new Prisma.Decimal("55.00"),
    fxFeePercent: new Prisma.Decimal("0.0100"),
    stripeFeeAmount: null,
    morphTxHash: null,
    morphTxStatus: "PENDING",
    morphRetryCount: 0,
    morphAnchorBlock: BigInt(1000),
    paidAt: new Date("2026-05-27T12:00:00Z"),
    createdAt: new Date("2026-05-27T12:00:00Z"),
    updatedAt: new Date("2026-05-27T12:00:00Z"),
    ...overrides,
  };
}

function makeInvoice(overrides: Partial<Invoice> = {}): Pick<Invoice, "userId"> & Partial<Invoice> {
  return {
    userId: "user_1",
    ...overrides,
  };
}

// ---------------- Test harness ----------------

type Harness = {
  service: SettlementService;
  prisma: DeepMockProxy<PrismaService>;
  walletClient: DeepMockProxy<MorphWalletClient>;
  publicClient: DeepMockProxy<MorphPublicClient>;
};

function buildHarness(): Harness {
  const prisma = mockDeep<PrismaService>();
  const walletClient = mockDeep<MorphWalletClient>();
  const publicClient = mockDeep<MorphPublicClient>();
  const service = new SettlementService(prisma, walletClient, publicClient, CONFIG);
  return { service, prisma, walletClient, publicClient };
}

// Pre-wire a happy-path transition for transitionToSettled — $transaction
// returns [updatedPayment, updatedInvoice]; we only care about the first
// element. Tests can override per-case if they need a different result.
function wireTransition(h: Harness, settledPayment: Payment): void {
  h.prisma.$transaction.mockImplementation(async (input) => {
    // Prisma's $transaction overload that takes an array returns Promise<results[]>;
    // since we already called the mocked update/findUnique/etc. before passing
    // here, we just resolve with the expected pair.
    if (Array.isArray(input)) {
      return [settledPayment, { id: "inv_1", status: "paid" }];
    }
    throw new Error("Unexpected $transaction shape in test");
  });
}

// ---------------- Tests ----------------

describe("SettlementService.settle", () => {
  let h: Harness;

  beforeEach(() => {
    h = buildHarness();
  });

  describe("idempotency", () => {
    it("returns immediately on a SETTLED row without re-submitting on-chain", async () => {
      const settled = makePayment({
        morphTxStatus: "SETTLED",
        morphTxHash: TX_HASH,
        morphRetryCount: 1,
      });
      h.prisma.payment.findUnique.mockResolvedValueOnce(settled);

      const result = await h.service.settle(makeArgs());

      expect(result).toBe(settled);
      expect(h.walletClient.writeContract).not.toHaveBeenCalled();
      expect(h.publicClient.waitForTransactionReceipt).not.toHaveBeenCalled();
      expect(h.prisma.$transaction).not.toHaveBeenCalled();
    });

    it("throws SettlementFailedError on a FAILED row without re-submitting", async () => {
      const failed = makePayment({ morphTxStatus: "FAILED", morphRetryCount: 5 });
      h.prisma.payment.findUnique.mockResolvedValueOnce(failed);

      await expect(h.service.settle(makeArgs())).rejects.toBeInstanceOf(SettlementFailedError);
      expect(h.walletClient.writeContract).not.toHaveBeenCalled();
    });
  });

  describe("happy path — first attempt", () => {
    it("creates anchor → submits viem tx → flips to SETTLED + invoice PAID", async () => {
      h.prisma.payment.findUnique.mockResolvedValueOnce(null);
      h.prisma.invoice.findUniqueOrThrow.mockResolvedValueOnce(makeInvoice() as Invoice);
      h.publicClient.getBlockNumber.mockResolvedValueOnce(BigInt(1000));
      h.prisma.payment.create.mockResolvedValueOnce(makePayment({ morphTxStatus: "PENDING" }));
      h.prisma.payment.update.mockResolvedValueOnce(
        makePayment({ morphTxStatus: "SETTLING", morphRetryCount: 1 }),
      );
      h.walletClient.writeContract.mockResolvedValueOnce(TX_HASH);
      h.publicClient.waitForTransactionReceipt.mockResolvedValueOnce(
        // viem returns a TransactionReceipt — only the type matters for our flow;
        // we never read the receipt body.
        { status: "success" } as never,
      );
      const settled = makePayment({
        morphTxStatus: "SETTLED",
        morphTxHash: TX_HASH,
        morphRetryCount: 1,
      });
      wireTransition(h, settled);

      const result = await h.service.settle(makeArgs());

      expect(result.morphTxStatus).toBe("SETTLED");
      expect(result.morphTxHash).toBe(TX_HASH);
      expect(h.prisma.payment.create).toHaveBeenCalledOnce();
      expect(h.walletClient.writeContract).toHaveBeenCalledOnce();
      expect(h.publicClient.waitForTransactionReceipt).toHaveBeenCalledWith({ hash: TX_HASH });
      expect(h.prisma.$transaction).toHaveBeenCalledOnce();
    });

    it("captures the anchor block from publicClient.getBlockNumber for the row", async () => {
      h.prisma.payment.findUnique.mockResolvedValueOnce(null);
      h.prisma.invoice.findUniqueOrThrow.mockResolvedValueOnce(makeInvoice() as Invoice);
      h.publicClient.getBlockNumber.mockResolvedValueOnce(BigInt(42_424_242));
      h.prisma.payment.create.mockResolvedValueOnce(
        makePayment({ morphAnchorBlock: BigInt(42_424_242) }),
      );
      h.prisma.payment.update.mockResolvedValueOnce(
        makePayment({ morphTxStatus: "SETTLING", morphRetryCount: 1 }),
      );
      h.walletClient.writeContract.mockResolvedValueOnce(TX_HASH);
      h.publicClient.waitForTransactionReceipt.mockResolvedValueOnce({
        status: "success",
      } as never);
      wireTransition(h, makePayment({ morphTxStatus: "SETTLED", morphTxHash: TX_HASH }));

      await h.service.settle(makeArgs());

      expect(h.prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ morphAnchorBlock: BigInt(42_424_242) }),
        }),
      );
    });
  });

  describe("retry — replay on SETTLING (no orphaned tx)", () => {
    it("re-submits on-chain when balance precheck finds no matching Transfer", async () => {
      const pending = makePayment({ morphTxStatus: "SETTLING", morphRetryCount: 1 });
      h.prisma.payment.findUnique.mockResolvedValueOnce(pending);
      h.prisma.payment.update.mockResolvedValueOnce(
        makePayment({ morphTxStatus: "SETTLING", morphRetryCount: 2 }),
      );
      // No matching Transfer events from prior attempts
      h.publicClient.getLogs.mockResolvedValueOnce([]);
      h.walletClient.writeContract.mockResolvedValueOnce(TX_HASH);
      h.publicClient.waitForTransactionReceipt.mockResolvedValueOnce({
        status: "success",
      } as never);
      wireTransition(h, makePayment({ morphTxStatus: "SETTLED", morphTxHash: TX_HASH }));

      const result = await h.service.settle(makeArgs());

      expect(result.morphTxStatus).toBe("SETTLED");
      expect(h.publicClient.getLogs).toHaveBeenCalledOnce();
      expect(h.walletClient.writeContract).toHaveBeenCalledOnce();
    });

    it("skips the precheck on the first attempt (retryCount=1 after increment)", async () => {
      h.prisma.payment.findUnique.mockResolvedValueOnce(null);
      h.prisma.invoice.findUniqueOrThrow.mockResolvedValueOnce(makeInvoice() as Invoice);
      h.publicClient.getBlockNumber.mockResolvedValueOnce(BigInt(1000));
      h.prisma.payment.create.mockResolvedValueOnce(makePayment({ morphTxStatus: "PENDING" }));
      h.prisma.payment.update.mockResolvedValueOnce(
        makePayment({ morphTxStatus: "SETTLING", morphRetryCount: 1 }),
      );
      h.walletClient.writeContract.mockResolvedValueOnce(TX_HASH);
      h.publicClient.waitForTransactionReceipt.mockResolvedValueOnce({
        status: "success",
      } as never);
      wireTransition(h, makePayment({ morphTxStatus: "SETTLED", morphTxHash: TX_HASH }));

      await h.service.settle(makeArgs());

      expect(h.publicClient.getLogs).not.toHaveBeenCalled();
    });

    it("warns and skips precheck on null-anchor retry; proceeds to fresh on-chain submission", async () => {
      const pending = makePayment({
        morphTxStatus: "SETTLING",
        morphRetryCount: 2,
        morphAnchorBlock: null,
      });
      h.prisma.payment.findUnique.mockResolvedValueOnce(pending);
      h.prisma.payment.update.mockResolvedValueOnce(
        makePayment({
          morphTxStatus: "SETTLING",
          morphRetryCount: 3,
          morphAnchorBlock: null,
        }),
      );
      const warnSpy = vi.spyOn(h.service["logger"], "warn").mockImplementation(() => undefined);
      h.walletClient.writeContract.mockResolvedValueOnce(TX_HASH);
      h.publicClient.waitForTransactionReceipt.mockResolvedValueOnce({
        status: "success",
      } as never);
      wireTransition(
        h,
        makePayment({ morphTxStatus: "SETTLED", morphTxHash: TX_HASH, morphRetryCount: 3 }),
      );

      await h.service.settle(makeArgs());

      expect(h.publicClient.getLogs).not.toHaveBeenCalled();
      expect(h.walletClient.writeContract).toHaveBeenCalledOnce();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Skipping balance precheck"));
    });
  });

  describe("retry — orphan adoption", () => {
    it("adopts a prior on-chain tx hash when getLogs finds a matching Transfer", async () => {
      const pending = makePayment({
        morphTxStatus: "SETTLING",
        morphRetryCount: 1,
        morphAnchorBlock: BigInt(900),
      });
      h.prisma.payment.findUnique.mockResolvedValueOnce(pending);
      h.prisma.payment.update.mockResolvedValueOnce(
        makePayment({
          morphTxStatus: "SETTLING",
          morphRetryCount: 2,
          morphAnchorBlock: BigInt(900),
        }),
      );
      // parseUnits("100", 6) = 100_000_000n
      h.publicClient.getLogs.mockResolvedValueOnce([
        {
          args: { value: BigInt(100_000_000) },
          transactionHash: ORPHANED_HASH,
        } as never,
      ]);
      h.prisma.payment.findMany.mockResolvedValueOnce([]);
      wireTransition(
        h,
        makePayment({ morphTxStatus: "SETTLED", morphTxHash: ORPHANED_HASH, morphRetryCount: 2 }),
      );

      const result = await h.service.settle(makeArgs());

      expect(result.morphTxStatus).toBe("SETTLED");
      expect(result.morphTxHash).toBe(ORPHANED_HASH);
      expect(h.walletClient.writeContract).not.toHaveBeenCalled();
      expect(h.publicClient.waitForTransactionReceipt).not.toHaveBeenCalled();
    });

    it("returns the first matching log when multiple candidates match (deterministic)", async () => {
      const pending = makePayment({
        morphTxStatus: "SETTLING",
        morphRetryCount: 1,
        morphAnchorBlock: BigInt(900),
      });
      h.prisma.payment.findUnique.mockResolvedValueOnce(pending);
      h.prisma.payment.update.mockResolvedValueOnce(
        makePayment({
          morphTxStatus: "SETTLING",
          morphRetryCount: 2,
          morphAnchorBlock: BigInt(900),
        }),
      );
      h.publicClient.getLogs.mockResolvedValueOnce([
        { args: { value: BigInt(100_000_000) }, transactionHash: HASH_A } as never,
        { args: { value: BigInt(100_000_000) }, transactionHash: HASH_B } as never,
      ]);
      // No row has claimed either hash yet — first match wins.
      h.prisma.payment.findMany.mockResolvedValueOnce([]);
      wireTransition(h, makePayment({ morphTxStatus: "SETTLED", morphTxHash: HASH_A }));

      await h.service.settle(makeArgs());

      expect(h.prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            morphTxStatus: "SETTLED",
            morphTxHash: HASH_A,
          }),
        }),
      );
      expect(h.walletClient.writeContract).not.toHaveBeenCalled();
    });

    it("skips a hash already claimed by another payment row and adopts the next match", async () => {
      const pending = makePayment({
        morphTxStatus: "SETTLING",
        morphRetryCount: 1,
        morphAnchorBlock: BigInt(900),
      });
      h.prisma.payment.findUnique.mockResolvedValueOnce(pending);
      h.prisma.payment.update.mockResolvedValueOnce(
        makePayment({
          morphTxStatus: "SETTLING",
          morphRetryCount: 2,
          morphAnchorBlock: BigInt(900),
        }),
      );
      h.publicClient.getLogs.mockResolvedValueOnce([
        { args: { value: BigInt(100_000_000) }, transactionHash: HASH_A } as never,
        { args: { value: BigInt(100_000_000) }, transactionHash: HASH_B } as never,
      ]);
      // HASH_A already claimed by a sibling payment — skip it, adopt HASH_B.
      h.prisma.payment.findMany.mockResolvedValueOnce([{ morphTxHash: HASH_A } as never]);
      wireTransition(h, makePayment({ morphTxStatus: "SETTLED", morphTxHash: HASH_B }));

      await h.service.settle(makeArgs());

      expect(h.prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            morphTxStatus: "SETTLED",
            morphTxHash: HASH_B,
          }),
        }),
      );
      expect(h.walletClient.writeContract).not.toHaveBeenCalled();
    });

    it("propagates P2002 when transitionToSettled collides on an adopted hash; row stays SETTLING", async () => {
      const pending = makePayment({
        morphTxStatus: "SETTLING",
        morphRetryCount: 1,
        morphAnchorBlock: BigInt(900),
      });
      h.prisma.payment.findUnique.mockResolvedValueOnce(pending);
      h.prisma.payment.update.mockResolvedValueOnce(
        makePayment({
          morphTxStatus: "SETTLING",
          morphRetryCount: 2,
          morphAnchorBlock: BigInt(900),
        }),
      );
      h.publicClient.getLogs.mockResolvedValueOnce([
        { args: { value: BigInt(100_000_000) }, transactionHash: ORPHANED_HASH } as never,
      ]);
      h.prisma.payment.findMany.mockResolvedValueOnce([]);
      const collision = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
        meta: { target: ["morph_tx_hash"] },
      });
      h.prisma.$transaction.mockRejectedValueOnce(collision);

      await expect(h.service.settle(makeArgs())).rejects.toBeInstanceOf(
        Prisma.PrismaClientKnownRequestError,
      );

      // Row stays SETTLING for the next retry — no FAILED transition attempted.
      expect(h.prisma.payment.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ morphTxStatus: "FAILED" }),
        }),
      );
      // We adopted, so we never re-submitted on-chain.
      expect(h.walletClient.writeContract).not.toHaveBeenCalled();
    });

    it("ignores Transfer events whose value doesn't match the expected amount", async () => {
      const pending = makePayment({
        morphTxStatus: "SETTLING",
        morphRetryCount: 1,
        morphAnchorBlock: BigInt(900),
      });
      h.prisma.payment.findUnique.mockResolvedValueOnce(pending);
      h.prisma.payment.update.mockResolvedValueOnce(
        makePayment({
          morphTxStatus: "SETTLING",
          morphRetryCount: 2,
          morphAnchorBlock: BigInt(900),
        }),
      );
      // Transfer exists but for a different amount — must not adopt.
      h.publicClient.getLogs.mockResolvedValueOnce([
        {
          args: { value: BigInt(999_999_999) },
          transactionHash: ORPHANED_HASH,
        } as never,
      ]);
      h.walletClient.writeContract.mockResolvedValueOnce(TX_HASH);
      h.publicClient.waitForTransactionReceipt.mockResolvedValueOnce({
        status: "success",
      } as never);
      wireTransition(h, makePayment({ morphTxStatus: "SETTLED", morphTxHash: TX_HASH }));

      const result = await h.service.settle(makeArgs());

      expect(result.morphTxHash).toBe(TX_HASH);
      expect(h.walletClient.writeContract).toHaveBeenCalledOnce();
    });
  });

  describe("max retries exhausted", () => {
    it("transitions to FAILED and throws when morphRetryCount >= MAX_RETRIES", async () => {
      const exhausted = makePayment({ morphTxStatus: "SETTLING", morphRetryCount: 5 });
      h.prisma.payment.findUnique.mockResolvedValueOnce(exhausted);
      h.prisma.payment.update.mockResolvedValueOnce(
        makePayment({ ...exhausted, morphTxStatus: "FAILED" }),
      );

      await expect(h.service.settle(makeArgs())).rejects.toBeInstanceOf(SettlementFailedError);
      expect(h.prisma.payment.update).toHaveBeenCalledWith({
        where: { id: exhausted.id },
        data: { morphTxStatus: "FAILED" },
      });
      // The SETTLING-increment update on line 131 must NOT run on the FAILED
      // path — bail-out happens before the retry-bump transition.
      expect(h.prisma.payment.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ morphTxStatus: "SETTLING" }),
        }),
      );
      expect(h.walletClient.writeContract).not.toHaveBeenCalled();
    });
  });

  describe("viem failures", () => {
    it("propagates a writeContract throw; row stays SETTLING for next retry", async () => {
      h.prisma.payment.findUnique.mockResolvedValueOnce(null);
      h.prisma.invoice.findUniqueOrThrow.mockResolvedValueOnce(makeInvoice() as Invoice);
      h.publicClient.getBlockNumber.mockResolvedValueOnce(BigInt(1000));
      h.prisma.payment.create.mockResolvedValueOnce(makePayment({ morphTxStatus: "PENDING" }));
      h.prisma.payment.update.mockResolvedValueOnce(
        makePayment({ morphTxStatus: "SETTLING", morphRetryCount: 1 }),
      );
      h.walletClient.writeContract.mockRejectedValueOnce(new Error("RPC timeout"));

      await expect(h.service.settle(makeArgs())).rejects.toThrow("RPC timeout");
      // Phase C must not have run — invoice not flipped, no SETTLED transition.
      expect(h.prisma.$transaction).not.toHaveBeenCalled();
    });

    it("propagates a waitForTransactionReceipt throw; SETTLED transition skipped", async () => {
      h.prisma.payment.findUnique.mockResolvedValueOnce(null);
      h.prisma.invoice.findUniqueOrThrow.mockResolvedValueOnce(makeInvoice() as Invoice);
      h.publicClient.getBlockNumber.mockResolvedValueOnce(BigInt(1000));
      h.prisma.payment.create.mockResolvedValueOnce(makePayment({ morphTxStatus: "PENDING" }));
      h.prisma.payment.update.mockResolvedValueOnce(
        makePayment({ morphTxStatus: "SETTLING", morphRetryCount: 1 }),
      );
      h.walletClient.writeContract.mockResolvedValueOnce(TX_HASH);
      h.publicClient.waitForTransactionReceipt.mockRejectedValueOnce(new Error("Receipt timeout"));

      await expect(h.service.settle(makeArgs())).rejects.toThrow("Receipt timeout");
      expect(h.prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe("P2002 race on Phase A", () => {
    it("re-reads the row and continues to Phase B when create collides on stripePaymentIntentId", async () => {
      h.prisma.payment.findUnique.mockResolvedValueOnce(null);
      h.prisma.invoice.findUniqueOrThrow.mockResolvedValueOnce(makeInvoice() as Invoice);
      h.publicClient.getBlockNumber.mockResolvedValueOnce(BigInt(1000));
      // Race: concurrent webhook inserted first
      h.prisma.payment.create.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "test",
        }),
      );
      const winnerRow = makePayment({ morphTxStatus: "PENDING", morphRetryCount: 0 });
      h.prisma.payment.findUniqueOrThrow.mockResolvedValueOnce(winnerRow);
      h.prisma.payment.update.mockResolvedValueOnce(
        makePayment({ morphTxStatus: "SETTLING", morphRetryCount: 1 }),
      );
      h.walletClient.writeContract.mockResolvedValueOnce(TX_HASH);
      h.publicClient.waitForTransactionReceipt.mockResolvedValueOnce({
        status: "success",
      } as never);
      wireTransition(h, makePayment({ morphTxStatus: "SETTLED", morphTxHash: TX_HASH }));

      const result = await h.service.settle(makeArgs());

      expect(result.morphTxStatus).toBe("SETTLED");
      expect(h.prisma.payment.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { stripePaymentIntentId: "pi_test_123" },
      });
      expect(h.walletClient.writeContract).toHaveBeenCalledOnce();
    });

    it("re-throws non-P2002 Prisma errors", async () => {
      h.prisma.payment.findUnique.mockResolvedValueOnce(null);
      h.prisma.invoice.findUniqueOrThrow.mockResolvedValueOnce(makeInvoice() as Invoice);
      h.publicClient.getBlockNumber.mockResolvedValueOnce(BigInt(1000));
      h.prisma.payment.create.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("Foreign key violation", {
          code: "P2003",
          clientVersion: "test",
        }),
      );

      await expect(h.service.settle(makeArgs())).rejects.toMatchObject({ code: "P2003" });
    });
  });

  describe("invoice not found", () => {
    it("propagates the Prisma error so the orchestrator handles it", async () => {
      h.prisma.payment.findUnique.mockResolvedValueOnce(null);
      h.prisma.invoice.findUniqueOrThrow.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("Record not found", {
          code: "P2025",
          clientVersion: "test",
        }),
      );

      await expect(h.service.settle(makeArgs())).rejects.toMatchObject({ code: "P2025" });
      expect(h.publicClient.getBlockNumber).not.toHaveBeenCalled();
      expect(h.prisma.payment.create).not.toHaveBeenCalled();
    });
  });
});
