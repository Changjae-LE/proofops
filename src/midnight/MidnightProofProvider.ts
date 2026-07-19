import type {
  CreateProofRequest,
  ProofProvider,
  ProofProviderResult,
  ProofVerificationResult,
  ProviderStatus,
} from "./ProofProvider";
import type { VerificationReceipt } from "../lib/receipt";

const PROOF_SERVER_PING_TIMEOUT_MS = 2000;

/**
 * Midnight network proof provider.
 *
 * Honesty contract for this hackathon build: this provider performs a real network
 * reachability check against the configured proof server, but does NOT submit real
 * transactions. Wiring a funded wallet, a deployed ProofOps Compact contract, and the
 * official @midnight-ntwrk SDK transaction flow was investigated (see
 * docs/MIDNIGHT_STATUS.md) but could not be completed and verified within this session.
 *
 * This class must never fabricate a transaction ID, contract address, or "success"
 * result. When real submission is not possible, it throws a clear, actionable error so
 * the UI can show an honest MIDNIGHT_FAILED / degraded state instead of a fake proof.
 */
export class MidnightProofProvider implements ProofProvider {
  readonly name = "midnight";
  readonly network: string;
  private readonly proofServerUrl: string;
  private readonly indexerUrl: string;
  private readonly contractAddress: string;

  constructor() {
    this.network = import.meta.env.VITE_MIDNIGHT_NETWORK || "undeployed";
    this.proofServerUrl = import.meta.env.VITE_MIDNIGHT_PROOF_SERVER_URL || "http://localhost:6300";
    this.indexerUrl = import.meta.env.VITE_MIDNIGHT_INDEXER_URL || "";
    this.contractAddress = import.meta.env.VITE_MIDNIGHT_CONTRACT_ADDRESS || "";
  }

  async getStatus(): Promise<ProviderStatus> {
    if (!this.contractAddress) {
      return {
        name: this.name,
        network: this.network,
        mode: "midnight",
        ready: false,
        message:
          "No deployed ProofOps contract address is configured (VITE_MIDNIGHT_CONTRACT_ADDRESS). " +
          "See docs/MIDNIGHT_STATUS.md.",
      };
    }

    const reachable = await this.pingProofServer();
    return {
      name: this.name,
      network: this.network,
      mode: "midnight",
      ready: false,
      message: reachable
        ? `Proof server at ${this.proofServerUrl} is reachable, but transaction submission is not implemented in this build.`
        : `Proof server at ${this.proofServerUrl} is unreachable. Falling back to LOCAL DEMO MODE is recommended.`,
    };
  }

  async createReceipt(_request: CreateProofRequest): Promise<ProofProviderResult> {
    throw new Error(
      "Midnight transaction submission is not implemented in this build. Real receipt creation " +
        "requires the official @midnight-ntwrk SDK wired to a funded wallet, a running proof server, " +
        "and a deployed ProofOps contract. See docs/MIDNIGHT_STATUS.md for the exact blocker and " +
        "reproduction steps. Set VITE_PROOF_PROVIDER=local to continue the demo without the network."
    );
  }

  async verifyReceipt(_receipt: VerificationReceipt): Promise<ProofVerificationResult> {
    return {
      verified: false,
      message:
        "Midnight on-chain verification is not implemented in this build. See docs/MIDNIGHT_STATUS.md.",
    };
  }

  private async pingProofServer(): Promise<boolean> {
    if (typeof fetch !== "function") {
      return false;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROOF_SERVER_PING_TIMEOUT_MS);
    try {
      await fetch(this.proofServerUrl, { signal: controller.signal });
      return true;
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Exposed for status/debug display; never used to fabricate a result. */
  getConfiguredIndexerUrl(): string {
    return this.indexerUrl;
  }
}
