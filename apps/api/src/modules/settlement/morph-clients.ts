import { createPublicClient, createWalletClient, http, type Chain, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { EnvConfig } from "@/common/config/env.schema";

// MORPH_* subset of EnvConfig — keeps the factories testable with a small
// fixture instead of forcing a full EnvConfig in every test. The structural
// Pick also breaks at compile-time if EnvSchema renames any of these.
export type MorphEnv = Pick<
  EnvConfig,
  | "MORPH_HOT_WALLET_PRIVATE_KEY"
  | "MORPH_USDC_CONTRACT_ADDRESS"
  | "MORPH_COINSPH_DEPOSIT_ADDRESS"
  | "MORPH_RPC_URL"
  | "MORPH_CHAIN_ID"
>;

// Morph Hoodi testnet chain definition. viem doesn't ship one out of the box.
// The canonical RPC URL is hardcoded as the chain default; the client
// factories below override it with the env-supplied URL via `http(...)` so
// the env stays authoritative (and tests can stub it).
export const morphHoodi = {
  id: 2910,
  name: "Morph Hoodi",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc-hoodi.morph.network"] },
  },
  blockExplorers: {
    default: { name: "Morph Explorer", url: "https://explorer-hoodi.morph.network" },
  },
  testnet: true,
} as const satisfies Chain;

// Read-only client for getBlockNumber / getLogs / waitForTransactionReceipt
// during the SettlementService balance-precheck + receipt-wait paths.
// Return type is intentionally inferred — viem's generic PublicClient widens
// `chain` to optional, but the concrete inferred type preserves chain: Chain.
export function createMorphPublicClient(env: MorphEnv) {
  return createPublicClient({
    chain: morphHoodi,
    transport: http(env.MORPH_RPC_URL),
  });
}

// Signs USDC.transfer calls from the hot wallet during SettlementService
// Phase B. The 0x-hex shape was validated by Zod at boot (HEX_PRIVATE_KEY_RE
// in env.schema.ts), so the cast is a type-only widening, not a runtime
// assertion. Return type inferred for the same reason as the public client.
export function createMorphWalletClient(env: MorphEnv) {
  const account = privateKeyToAccount(env.MORPH_HOT_WALLET_PRIVATE_KEY as Hex);
  return createWalletClient({
    account,
    chain: morphHoodi,
    transport: http(env.MORPH_RPC_URL),
  });
}

export type MorphPublicClient = ReturnType<typeof createMorphPublicClient>;
export type MorphWalletClient = ReturnType<typeof createMorphWalletClient>;
