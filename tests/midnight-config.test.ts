import { describe, expect, it, afterEach } from "vitest";
import {
  getNetwork,
  getNetworkConfig,
  resolveWalletSecret,
  getConfiguredContractAddress,
  LOCAL_DEVNET_SEED,
} from "../server/midnight/config";

const ENV_KEYS = [
  "MIDNIGHT_NETWORK",
  "MIDNIGHT_LOCAL_SEED",
  "MIDNIGHT_PREVIEW_SEED",
  "MIDNIGHT_PREVIEW_MNEMONIC",
  "MIDNIGHT_PREPROD_SEED",
  "MIDNIGHT_PREPROD_MNEMONIC",
  "MIDNIGHT_CONTRACT_ADDRESS",
] as const;

function clearEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
}

describe("Midnight configuration validation", () => {
  afterEach(clearEnv);

  it("defaults to the local network when MIDNIGHT_NETWORK is unset", () => {
    clearEnv();
    expect(getNetwork()).toBe("local");
  });

  it("accepts local, preview, and preprod", () => {
    for (const network of ["local", "preview", "preprod"]) {
      process.env.MIDNIGHT_NETWORK = network;
      expect(getNetwork()).toBe(network);
    }
  });

  it("rejects an unknown network name", () => {
    process.env.MIDNIGHT_NETWORK = "mainnet";
    expect(() => getNetwork()).toThrow(/Unknown MIDNIGHT_NETWORK/);
  });

  it("returns distinct public endpoints per network", () => {
    const local = getNetworkConfig("local");
    const preview = getNetworkConfig("preview");
    const preprod = getNetworkConfig("preprod");
    expect(local.networkId).toBe("undeployed");
    expect(preview.networkId).toBe("preview");
    expect(preprod.networkId).toBe("preprod");
    expect(new Set([local.indexer, preview.indexer, preprod.indexer]).size).toBe(3);
  });

  it("resolves the well-known public devnet seed for local with no configuration", () => {
    clearEnv();
    const secret = resolveWalletSecret("local");
    expect(secret).toEqual({ kind: "seed", value: LOCAL_DEVNET_SEED });
  });

  it("requires a seed or mnemonic to be configured for preprod", () => {
    clearEnv();
    expect(() => resolveWalletSecret("preprod")).toThrow(/MIDNIGHT_PREPROD_(SEED|MNEMONIC)/);
  });

  it("rejects setting both a seed and a mnemonic for the same network", () => {
    process.env.MIDNIGHT_PREPROD_SEED = "aa".repeat(32);
    process.env.MIDNIGHT_PREPROD_MNEMONIC = "word ".repeat(24).trim();
    expect(() => resolveWalletSecret("preprod")).toThrow(/Set only one of/);
  });

  it("rejects a malformed hex seed (odd length or non-hex characters)", () => {
    process.env.MIDNIGHT_PREPROD_SEED = "not-hex";
    expect(() => resolveWalletSecret("preprod")).toThrow(/hex string/);

    process.env.MIDNIGHT_PREPROD_SEED = "abc"; // odd length
    expect(() => resolveWalletSecret("preprod")).toThrow(/hex string/);
  });

  it("accepts a valid 64-char hex seed for preprod", () => {
    process.env.MIDNIGHT_PREPROD_SEED = "ab".repeat(32);
    const secret = resolveWalletSecret("preprod");
    expect(secret).toEqual({ kind: "seed", value: "ab".repeat(32) });
  });

  it("accepts a mnemonic for preview", () => {
    process.env.MIDNIGHT_PREVIEW_MNEMONIC = "word ".repeat(24).trim();
    const secret = resolveWalletSecret("preview");
    expect(secret.kind).toBe("mnemonic");
  });

  it("returns undefined when no contract address is configured, and the trimmed value otherwise", () => {
    clearEnv();
    expect(getConfiguredContractAddress()).toBeUndefined();
    process.env.MIDNIGHT_CONTRACT_ADDRESS = "  0xabc123  ";
    expect(getConfiguredContractAddress()).toBe("0xabc123");
  });
});
