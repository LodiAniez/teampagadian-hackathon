import { describe, expect, it } from "vitest";
import type { EnvConfig } from "@/common/config/env.schema";
import {
  createMorphPublicClient,
  createMorphWalletClient,
  morphHoodi,
  type MorphEnv,
} from "./morph-clients";

// Realistic test fixture. Private key `0x0...01` derives deterministically
// to the address asserted below per secp256k1 — well-known test vector.
const FIXTURE_ENV: MorphEnv = {
  MORPH_HOT_WALLET_PRIVATE_KEY:
    "0x0000000000000000000000000000000000000000000000000000000000000001",
  MORPH_USDC_CONTRACT_ADDRESS: "0x1111111111111111111111111111111111111111",
  MORPH_COINSPH_DEPOSIT_ADDRESS: "0x2222222222222222222222222222222222222222",
  MORPH_RPC_URL: "https://rpc-hoodi.morph.network",
  MORPH_CHAIN_ID: 2910,
};

const PRIVATE_KEY_0X01_ADDRESS = "0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf";

describe("morphHoodi chain", () => {
  it("declares chain id 2910 (Morph Hoodi testnet)", () => {
    expect(morphHoodi.id).toBe(2910);
  });

  it("uses Morph Hoodi as the chain name", () => {
    expect(morphHoodi.name).toBe("Morph Hoodi");
  });

  it("has ETH as the native currency (18 decimals — Morph is EVM)", () => {
    expect(morphHoodi.nativeCurrency).toEqual({
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    });
  });

  it("points block explorer at the Morph Hoodi explorer URL", () => {
    expect(morphHoodi.blockExplorers?.default.url).toBe("https://explorer-hoodi.morph.network");
  });
});

describe("createMorphPublicClient", () => {
  it("binds to the Morph Hoodi chain", () => {
    const client = createMorphPublicClient(FIXTURE_ENV);
    expect(client.chain.id).toBe(2910);
  });

  it("uses the env-provided RPC URL (transport override beats the static chain default)", () => {
    const client = createMorphPublicClient({
      ...FIXTURE_ENV,
      MORPH_RPC_URL: "https://custom-rpc.example.com",
    });
    // viem's http transport exposes the URL via transport.url
    expect(client.transport.url).toBe("https://custom-rpc.example.com");
  });
});

describe("createMorphWalletClient", () => {
  it("derives the account address from the configured private key", () => {
    const client = createMorphWalletClient(FIXTURE_ENV);
    expect(client.account.address).toBe(PRIVATE_KEY_0X01_ADDRESS);
  });

  it("binds to the Morph Hoodi chain", () => {
    const client = createMorphWalletClient(FIXTURE_ENV);
    expect(client.chain.id).toBe(2910);
  });

  it("uses the env-provided RPC URL", () => {
    const client = createMorphWalletClient({
      ...FIXTURE_ENV,
      MORPH_RPC_URL: "https://custom-rpc.example.com",
    });
    expect(client.transport.url).toBe("https://custom-rpc.example.com");
  });
});

// Tiny structural assertion that the picked MorphEnv shape stays in sync
// with EnvConfig — if EnvSchema renames any MORPH_* var the picked type
// breaks at compile time and this assignment fails the typecheck.
describe("MorphEnv type", () => {
  it("is structurally assignable from EnvConfig (compile-time guard)", () => {
    const _check = (env: EnvConfig): MorphEnv => env;
    expect(typeof _check).toBe("function");
  });
});
