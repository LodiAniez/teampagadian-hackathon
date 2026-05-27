import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Hex } from "viem";
import type { EnvConfig } from "@/common/config/env.schema";
import { PrismaModule } from "../../common/prisma/prisma.module";
import {
  createMorphPublicClient,
  createMorphWalletClient,
  type MorphEnv,
  type MorphWalletClient,
} from "./morph-clients";
import { SettlementService } from "./settlement.service";
import {
  MORPH_PUBLIC_CLIENT,
  MORPH_WALLET_CLIENT,
  SETTLEMENT_CONFIG,
  type SettlementConfig,
} from "./settlement.types";

// Single source of truth for the MorphEnv subset — both viem client factories
// consume the same shape, so deriving it once keeps the providers consistent
// and the diffs small if a new MORPH_* var is added.
function morphEnvFromConfig(config: ConfigService<EnvConfig, true>): MorphEnv {
  return {
    MORPH_HOT_WALLET_PRIVATE_KEY: config.get("MORPH_HOT_WALLET_PRIVATE_KEY", { infer: true }),
    MORPH_USDC_CONTRACT_ADDRESS: config.get("MORPH_USDC_CONTRACT_ADDRESS", { infer: true }),
    MORPH_COINSPH_DEPOSIT_ADDRESS: config.get("MORPH_COINSPH_DEPOSIT_ADDRESS", { infer: true }),
    MORPH_RPC_URL: config.get("MORPH_RPC_URL", { infer: true }),
    MORPH_CHAIN_ID: config.get("MORPH_CHAIN_ID", { infer: true }),
  };
}

@Module({
  imports: [PrismaModule],
  providers: [
    {
      provide: MORPH_PUBLIC_CLIENT,
      useFactory: (config: ConfigService<EnvConfig, true>) =>
        createMorphPublicClient(morphEnvFromConfig(config)),
      inject: [ConfigService],
    },
    {
      provide: MORPH_WALLET_CLIENT,
      useFactory: (config: ConfigService<EnvConfig, true>) =>
        createMorphWalletClient(morphEnvFromConfig(config)),
      inject: [ConfigService],
    },
    {
      // Pre-derive the three Hex addresses the service needs. hotWalletAddress
      // comes from the wallet client's account (already derived by
      // privateKeyToAccount inside createMorphWalletClient), so we don't run
      // that derivation twice. The `as Hex` casts on the env reads are safe:
      // Zod's HEX_ADDRESS_RE already validated the shape at boot.
      provide: SETTLEMENT_CONFIG,
      useFactory: (
        config: ConfigService<EnvConfig, true>,
        walletClient: MorphWalletClient,
      ): SettlementConfig => ({
        usdcContract: config.get("MORPH_USDC_CONTRACT_ADDRESS", { infer: true }) as Hex,
        coinsphDeposit: config.get("MORPH_COINSPH_DEPOSIT_ADDRESS", { infer: true }) as Hex,
        hotWalletAddress: walletClient.account.address,
      }),
      inject: [ConfigService, MORPH_WALLET_CLIENT],
    },
    SettlementService,
  ],
  exports: [SettlementService],
})
export class SettlementModule {}
