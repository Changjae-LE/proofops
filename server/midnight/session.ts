// Lazily-initialized, process-wide Midnight session: one wallet, synced once, reused
// across requests. Initialization (wallet build + sync, potentially a real network round
// trip) only happens on first use, so server startup and unrelated health checks never
// pay for it and never require Midnight to be configured at all.
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import type { EnvironmentConfiguration } from "@midnight-ntwrk/testkit-js";
import type { ContractAddress } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";
import { logger } from "../logger";
import {
  getConfiguredContractAddress,
  getNetwork,
  getNetworkConfig,
  resolveWalletSecret,
  type MidnightNetwork,
  type NetworkConfig,
} from "./config";
import { MidnightWalletProvider, syncWallet } from "./wallet";
import { buildProviders, type ProofOpsProviders } from "./providers";
import { deployProofOpsContract, joinProofOpsContract, type DeployedProofOpsContract } from "./deploy";
import { zkConfigPath } from "./contract";

export type MidnightSession = {
  network: MidnightNetwork;
  config: NetworkConfig;
  wallet: MidnightWalletProvider;
  providers: ProofOpsProviders;
  contractAddress: ContractAddress | undefined;
  deployed: DeployedProofOpsContract | undefined;
};

export type SessionState =
  | { phase: "idle" }
  | { phase: "initializing" }
  | { phase: "ready"; network: MidnightNetwork; contractAddress: ContractAddress | undefined }
  | { phase: "error"; message: string };

let sessionPromise: Promise<MidnightSession> | null = null;
let state: SessionState = { phase: "idle" };

/** Cheap, synchronous snapshot - never triggers initialization or blocks on network I/O. */
export function getSessionState(): SessionState {
  return state;
}

function walletSyncTimeoutMs(network: MidnightNetwork): number {
  const configured = process.env.MIDNIGHT_SYNC_TIMEOUT_MS;
  if (configured) return Number(configured);
  return network === "local" ? 10 * 60_000 : 60 * 60_000;
}

async function initSession(): Promise<MidnightSession> {
  const network = getNetwork();
  const config = getNetworkConfig(network);
  const secret = resolveWalletSecret(network);

  setNetworkId(config.networkId);

  const envConfig: EnvironmentConfiguration = {
    walletNetworkId: config.networkId,
    networkId: config.networkId,
    indexer: config.indexer,
    indexerWS: config.indexerWS,
    node: config.node,
    nodeWS: config.nodeWS,
    faucet: config.faucet,
    proofServer: config.proofServer,
  };

  const wallet = await MidnightWalletProvider.build(envConfig, secret);
  await wallet.start();
  await syncWallet(wallet.wallet, walletSyncTimeoutMs(network));

  const providers = buildProviders(wallet, zkConfigPath, config);

  const configuredAddress = getConfiguredContractAddress();
  let deployed: DeployedProofOpsContract | undefined;
  if (configuredAddress) {
    deployed = await joinProofOpsContract(providers, configuredAddress);
  }

  logger.info("midnight_session_ready", { network, contractAddress: configuredAddress });

  return {
    network,
    config,
    wallet,
    providers,
    contractAddress: configuredAddress,
    deployed,
  };
}

export function getMidnightSession(): Promise<MidnightSession> {
  if (!sessionPromise) {
    state = { phase: "initializing" };
    sessionPromise = initSession()
      .then((session) => {
        state = { phase: "ready", network: session.network, contractAddress: session.contractAddress };
        return session;
      })
      .catch((err) => {
        // Allow retry on next call instead of caching a permanent failure.
        sessionPromise = null;
        state = { phase: "error", message: err instanceof Error ? err.message : String(err) };
        throw err;
      });
  }
  return sessionPromise;
}

export async function deployNewContract(): Promise<MidnightSession> {
  const session = await getMidnightSession();
  if (session.deployed) {
    throw new Error(
      `A contract is already configured at ${session.contractAddress}. Unset MIDNIGHT_CONTRACT_ADDRESS to deploy a new one.`,
    );
  }
  const deployed = await deployProofOpsContract(session.providers);
  session.deployed = deployed;
  session.contractAddress = deployed.deployTxData.public.contractAddress;
  state = { phase: "ready", network: session.network, contractAddress: session.contractAddress };
  return session;
}

/** Test-only: forces the next getMidnightSession() call to re-initialize. */
export function resetMidnightSessionForTests(): void {
  sessionPromise = null;
  state = { phase: "idle" };
}
