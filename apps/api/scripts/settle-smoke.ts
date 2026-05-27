/**
 * TEA-76 settlement smoke test — runs ONE real 1 USDC transfer on Morph
 * Hoodi testnet through the full SettlementService.settle() flow, including
 * DB anchor + invoice flip. Use this to verify the on-chain leg is wired
 * end-to-end: viem signing, RPC reachability, waitForTransactionReceipt
 * timing, ERC20 ABI shape, and the PENDING→SETTLING→SETTLED DB transition.
 *
 * Gated behind RAKET_MORPH_SMOKE=1 so it can't fire accidentally — this
 * spends testnet ETH (gas) and burns 1 mock USDC from the hot wallet on
 * every run.
 *
 * Run:
 *   RAKET_MORPH_SMOKE=1 npx tsx apps/api/scripts/settle-smoke.ts
 *
 * On success: prints the Morph explorer URL for the transfer and exits 0.
 * On failure: prints the error and exits non-zero. Leaves the User / Client /
 * Invoice / Payment rows behind for inspection — no cleanup.
 */
import { randomUUID } from "node:crypto";
import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/common/prisma/prisma.service";
import { morphHoodi } from "../src/modules/settlement/morph-clients";
import { SettlementService } from "../src/modules/settlement/settlement.service";

const GATE = "RAKET_MORPH_SMOKE";
const SMOKE_AMOUNT_USD = 1;
const TAG = "settle-smoke";

async function main(): Promise<void> {
  if (process.env[GATE] !== "1") {
    console.error(
      [
        "Refusing to run: this script sends a REAL 1 USDC transfer on Morph",
        "Hoodi testnet from the configured hot wallet on every invocation.",
        `Set ${GATE}=1 to confirm you want that to happen.`,
      ].join("\n"),
    );
    process.exit(1);
  }

  const logger = new Logger(TAG);

  // Boot the full Nest context so SettlementService receives its real DI
  // dependencies (env-validated MorphEnv, configured viem clients, real
  // PrismaService). Errors/warnings only — silence Nest's startup chatter.
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });

  try {
    const settlement = app.get(SettlementService);
    const prisma = app.get(PrismaService);

    // Fresh fixtures per run — phone is unique so we can't recycle, and a
    // fresh paymentIntentId keeps the SETTLED dedup path from triggering on
    // back-to-back runs.
    const runId = randomUUID().slice(0, 8);
    logger.log(`Run ${runId}: creating fixtures…`);

    const user = await prisma.user.create({
      data: {
        phone: `+1${Date.now().toString().padStart(11, "0").slice(-11)}`,
        name: `Smoke ${runId}`,
      },
    });
    const client = await prisma.client.create({
      data: {
        userId: user.id,
        name: `Smoke Client ${runId}`,
        defaultCurrency: "USD",
      },
    });
    const invoice = await prisma.invoice.create({
      data: {
        userId: user.id,
        clientId: client.id,
        number: `SMOKE-${runId}`,
        amount: SMOKE_AMOUNT_USD,
        currency: "USD",
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        sourceType: "manual",
        status: "sent",
      },
    });
    logger.log(`Created user=${user.id} client=${client.id} invoice=${invoice.id}`);

    // Placeholder FX values — the smoke test isn't validating math, only the
    // on-chain leg + DB write. PaymentsService (TEA-42) computes these for
    // real from FxRateService at webhook time.
    const args = {
      paymentIntentId: `pi_smoke_${runId}`,
      stripeChargeId: `ch_smoke_${runId}`,
      invoiceId: invoice.id,
      amountReceived: SMOKE_AMOUNT_USD,
      amountReceivedCurrency: "USD",
      fxRate: 55.0,
      fxFeeAmount: 0.55,
      fxFeePercent: 0.01,
      amountPhp: 54.45,
      paidAt: new Date(),
    };

    logger.log(`Calling settle() with 1 USDC transfer…`);
    const before = Date.now();
    const payment = await settlement.settle(args);
    const elapsedMs = Date.now() - before;

    if (payment.morphTxStatus !== "SETTLED") {
      throw new Error(
        `Expected morphTxStatus=SETTLED, got ${payment.morphTxStatus} (payment ${payment.id})`,
      );
    }
    if (!payment.morphTxHash) {
      throw new Error(
        `Expected morphTxHash to be set on a SETTLED payment (payment ${payment.id})`,
      );
    }

    const updatedInvoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoice.id },
      select: { status: true },
    });
    if (updatedInvoice.status !== "paid") {
      throw new Error(
        `Expected invoice ${invoice.id} to be flipped to status=paid, got ${updatedInvoice.status}`,
      );
    }

    const explorerBase = morphHoodi.blockExplorers.default.url;
    logger.log(`✓ Settled in ${elapsedMs}ms`);
    logger.log(`  payment.id         = ${payment.id}`);
    logger.log(`  payment.morphTxHash = ${payment.morphTxHash}`);
    logger.log(`  invoice.status      = ${updatedInvoice.status}`);
    logger.log(`  explorer            = ${explorerBase}/tx/${payment.morphTxHash}`);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(`[${TAG}] failed:`, err);
  process.exit(1);
});
