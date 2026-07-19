import { type MidnightProviders } from "@midnight-ntwrk/midnight-js-types";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import type { MidnightWalletProvider } from "./wallet";
import type { NetworkConfig } from "./config";
import type { ProofOpsCircuits } from "./contract";
import type { ProofOpsPrivateState } from "../../contract/src/witnesses";

export type ProofOpsProviders = MidnightProviders<ProofOpsCircuits, "proofOpsPrivateState", ProofOpsPrivateState>;

export function buildProviders(
  wallet: MidnightWalletProvider,
  zkConfigPath: string,
  config: NetworkConfig,
): ProofOpsProviders {
  const zkConfigProvider = new NodeZkConfigProvider<ProofOpsCircuits>(zkConfigPath);

  return {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: "proofops-private-state",
      privateStoragePasswordProvider: () => process.env.MIDNIGHT_PRIVATE_STATE_PASSWORD ?? "ProofOps-Private-State",
      accountId: wallet.getCoinPublicKey(),
    }),
    publicDataProvider: indexerPublicDataProvider(config.indexer, config.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(config.proofServer, zkConfigProvider),
    walletProvider: wallet,
    midnightProvider: wallet,
  };
}
