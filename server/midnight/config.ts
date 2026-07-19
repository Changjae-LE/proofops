// Network configuration for real Midnight integration. Values here are either public
// endpoints or read from server-only environment variables (never VITE_-prefixed, so
// they are never inlined into the browser bundle by Vite).
export type MidnightNetwork = "local" | "preview" | "preprod";

export type NetworkConfig = {
  networkId: string;
  indexer: string;
  indexerWS: string;
  node: string;
  nodeWS: string;
  proofServer: string;
  faucet: string;
};

export const LOCAL_CONFIG: NetworkConfig = {
  networkId: "undeployed",
  indexer: "http://127.0.0.1:8088/api/v4/graphql",
  indexerWS: "ws://127.0.0.1:8088/api/v4/graphql/ws",
  node: "http://127.0.0.1:9944",
  nodeWS: "ws://127.0.0.1:9944",
  proofServer: process.env.MIDNIGHT_PROOF_SERVER ?? "http://127.0.0.1:6300",
  faucet: "",
};

export const PREVIEW_CONFIG: NetworkConfig = {
  networkId: "preview",
  indexer: "https://indexer.preview.midnight.network/api/v4/graphql",
  indexerWS: "wss://indexer.preview.midnight.network/api/v4/graphql/ws",
  node: "https://rpc.preview.midnight.network",
  nodeWS: "wss://rpc.preview.midnight.network",
  proofServer: process.env.MIDNIGHT_PROOF_SERVER ?? "http://127.0.0.1:6300",
  faucet: "https://midnight-tmnight-preview.nethermind.dev/",
};

export const PREPROD_CONFIG: NetworkConfig = {
  networkId: "preprod",
  indexer: "https://indexer.preprod.midnight.network/api/v4/graphql",
  indexerWS: "wss://indexer.preprod.midnight.network/api/v4/graphql/ws",
  node: "https://rpc.preprod.midnight.network",
  nodeWS: "wss://rpc.preprod.midnight.network",
  proofServer: process.env.MIDNIGHT_PROOF_SERVER ?? "http://127.0.0.1:6300",
  faucet: "https://midnight-tmnight-preprod.nethermind.dev/",
};

export function getNetwork(): MidnightNetwork {
  const raw = (process.env.MIDNIGHT_NETWORK ?? "local").toLowerCase();
  if (raw === "local" || raw === "preview" || raw === "preprod") {
    return raw;
  }
  throw new Error(`Unknown MIDNIGHT_NETWORK '${raw}'. Supported: 'local', 'preview', 'preprod'.`);
}

export function getNetworkConfig(network: MidnightNetwork = getNetwork()): NetworkConfig {
  if (network === "local") return LOCAL_CONFIG;
  if (network === "preview") return PREVIEW_CONFIG;
  return PREPROD_CONFIG;
}

/** Well-known devnet seed used by the official Midnight examples (public, not a secret). */
export const LOCAL_DEVNET_SEED = "0000000000000000000000000000000000000000000000000000000000000001";

export type WalletSecret = { kind: "seed"; value: string } | { kind: "mnemonic"; value: string };

/**
 * Resolves the wallet secret for the active network from server-only env vars
 * (MIDNIGHT_<NETWORK>_SEED or MIDNIGHT_<NETWORK>_MNEMONIC). Local devnet defaults to the
 * well-known, publicly documented devnet seed so `npm run midnight:demo` works with zero
 * configuration against Docker.
 */
export function resolveWalletSecret(network: MidnightNetwork): WalletSecret {
  if (network === "local") {
    return { kind: "seed", value: process.env.MIDNIGHT_LOCAL_SEED ?? LOCAL_DEVNET_SEED };
  }

  const upper = network.toUpperCase();
  const mnemonicEnv = `MIDNIGHT_${upper}_MNEMONIC`;
  const seedEnv = `MIDNIGHT_${upper}_SEED`;
  const mnemonic = process.env[mnemonicEnv]?.trim().replace(/\s+/g, " ");
  const seedHex = process.env[seedEnv]?.trim();

  if (mnemonic && seedHex) {
    throw new Error(`Set only one of ${mnemonicEnv} or ${seedEnv} (both are defined).`);
  }
  if (mnemonic) {
    return { kind: "mnemonic", value: mnemonic };
  }
  if (seedHex) {
    if (!/^[0-9a-fA-F]+$/.test(seedHex) || seedHex.length % 2 !== 0) {
      throw new Error(`${seedEnv} must be a hex string of even length (no 0x prefix).`);
    }
    return { kind: "seed", value: seedHex };
  }
  throw new Error(
    `Either ${mnemonicEnv} or ${seedEnv} is required for network '${network}'. Set one in .env.${network}.`,
  );
}

export function getConfiguredContractAddress(): string | undefined {
  const value = process.env.MIDNIGHT_CONTRACT_ADDRESS?.trim();
  return value ? value : undefined;
}
