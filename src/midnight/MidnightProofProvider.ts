import { buildReceiptCore, isValidReceiptShape } from "../lib/receipt";
import type {
  CreateProofRequest,
  ProofProvider,
  ProofProviderResult,
  ProofVerificationResult,
  ProviderStatus,
} from "./ProofProvider";
import type { VerificationReceipt } from "../lib/receipt";

type StatusResponse =
  | { configured: false; message: string }
  | {
      configured: true;
      network: string;
      configuredContractAddress: string | null;
      phase: "idle" | "initializing" | "ready" | "error";
      contractAddress?: string | null;
      message?: string;
    };

type LedgerResponse = {
  network: string;
  contractAddress: string;
  ledger: {
    incidentIdHash: string;
    evidenceCommitment: string;
    policyLimitMinutes: number;
    policySatisfied: boolean;
    receiptCount: number;
  };
};

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function errorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "error" in body && typeof (body as { error: unknown }).error === "string") {
    return (body as { error: string }).error;
  }
  return fallback;
}

/**
 * Real Midnight network proof provider. Unlike a purely client-side abstraction, all
 * wallet and SDK operations run server-side (see server/midnight/*) - the wallet secret
 * and Node-only packages (testkit-js, ws) must never enter the browser bundle, since
 * anything under import.meta.env.VITE_* is inlined into public JS. This class only ever
 * talks to this app's own trusted /api/midnight/* endpoints over the same origin; it
 * never fabricates a transaction ID, contract address, or MIDNIGHT_CONFIRMED status -
 * those only ever come from a real server response after real network confirmation.
 */
export class MidnightProofProvider implements ProofProvider {
  readonly name = "midnight";
  network: string;

  constructor() {
    this.network = import.meta.env.VITE_MIDNIGHT_NETWORK || "undeployed";
  }

  async getStatus(): Promise<ProviderStatus> {
    let res: Response;
    try {
      res = await fetch("/api/midnight/status");
    } catch {
      return {
        name: this.name,
        network: this.network,
        mode: "midnight",
        ready: false,
        message: "Could not reach the ProofOps API to check Midnight status.",
      };
    }

    const data = (await readJson(res)) as StatusResponse;
    if (!data.configured) {
      return {
        name: this.name,
        network: this.network,
        mode: "midnight",
        ready: false,
        message: data.message,
      };
    }

    this.network = data.network;
    const phaseMessages: Record<string, string> = {
      idle: "Configured but not connected yet. Click Connect Wallet to sync.",
      initializing: "Connecting wallet and syncing with the network - this can take a while on a remote network.",
      ready: data.contractAddress
        ? `Connected. Contract: ${data.contractAddress}`
        : "Wallet connected. No contract deployed or joined yet.",
      error: data.message ?? "Wallet connection failed.",
    };

    return {
      name: this.name,
      network: data.network,
      mode: "midnight",
      ready: data.phase === "ready",
      message: phaseMessages[data.phase] ?? "Unknown state.",
      walletConnected: data.phase === "ready",
      contractAddress: data.phase === "ready" ? (data.contractAddress ?? null) : null,
    };
  }

  /** Triggers server-side wallet build + sync. Can take a long time on a remote network. */
  async connectWallet(): Promise<{ network: string; contractAddress: string | null; coinPublicKey: string }> {
    const res = await fetch("/api/midnight/connect", { method: "POST" });
    const body = await readJson(res);
    if (!res.ok) {
      throw new Error(errorMessage(body, "Wallet connection failed."));
    }
    return body as { network: string; contractAddress: string | null; coinPublicKey: string };
  }

  /** Deploys a brand-new ProofOps contract. Fails if one is already configured/joined. */
  async deployContract(): Promise<{ network: string; contractAddress: string }> {
    const res = await fetch("/api/midnight/deploy", { method: "POST" });
    const body = await readJson(res);
    if (!res.ok) {
      throw new Error(errorMessage(body, "Contract deployment failed."));
    }
    return body as { network: string; contractAddress: string };
  }

  async readLedgerState(): Promise<LedgerResponse> {
    const res = await fetch("/api/midnight/ledger");
    const body = await readJson(res);
    if (!res.ok) {
      throw new Error(errorMessage(body, "Ledger query failed."));
    }
    return body as LedgerResponse;
  }

  /**
   * Builds the public commitments client-side (unchanged from local mode - raw evidence
   * never leaves the browser), then asks the server to submit a real submitReceipt
   * transaction. responseMinutes is sent only as the private witness input; it is read
   * once by the circuit's assertion and is never written to the ledger or echoed back.
   */
  async createReceipt(request: CreateProofRequest): Promise<ProofProviderResult> {
    const core = await buildReceiptCore(request.analysis, request.evidence);

    const res = await fetch("/api/midnight/receipt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        incidentIdHash: core.incidentIdHash,
        evidenceCommitment: core.evidenceCommitment,
        policyLimitMinutes: request.analysis.policy.limitMinutes,
        responseMinutes: request.responseMinutes,
      }),
    });
    const body = await readJson(res);

    if (!res.ok) {
      // Includes the case where the circuit's assertion fails (private response time
      // exceeds the public policy limit): the server never returns 200 in that case, so
      // this always throws instead of returning a fabricated receipt.
      throw new Error(errorMessage(body, "Midnight transaction submission failed."));
    }

    const data = body as {
      status: "MIDNIGHT_CONFIRMED";
      network: string;
      contractAddress: string;
      txId: string;
      blockHeight: number;
    };

    this.network = data.network;

    return {
      receipt: {
        ...core,
        provider: this.name,
        network: data.network,
        status: "MIDNIGHT_CONFIRMED",
        transactionId: data.txId,
        contractAddress: data.contractAddress,
      },
    };
  }

  async verifyReceipt(receipt: VerificationReceipt): Promise<ProofVerificationResult> {
    if (!isValidReceiptShape(receipt)) {
      return { verified: false, message: "Receipt does not match the expected schema." };
    }
    if (receipt.status !== "MIDNIGHT_CONFIRMED" || !receipt.contractAddress) {
      return {
        verified: false,
        message: `Midnight provider cannot verify a receipt with status "${receipt.status}" (no confirmed on-chain transaction).`,
      };
    }

    let ledgerData: LedgerResponse;
    try {
      ledgerData = await this.readLedgerState();
    } catch (err) {
      return { verified: false, message: err instanceof Error ? err.message : "Ledger query failed." };
    }

    if (ledgerData.contractAddress !== receipt.contractAddress) {
      return {
        verified: false,
        message: `The currently configured contract (${ledgerData.contractAddress}) does not match this receipt's contract address (${receipt.contractAddress}).`,
      };
    }

    const matches =
      ledgerData.ledger.evidenceCommitment === receipt.evidenceCommitment &&
      ledgerData.ledger.incidentIdHash === receipt.incidentIdHash &&
      ledgerData.ledger.policySatisfied === receipt.policySatisfied;

    if (!matches) {
      return {
        verified: false,
        message:
          "On-chain ledger state does not match this receipt. Note: the ProofOps contract's public ledger " +
          "holds only the most recently submitted receipt (receiptCount increments, but earlier commitments " +
          "are overwritten) - if a newer receipt has been submitted since this one, this is expected, not " +
          "evidence of tampering. See docs/THREAT_MODEL.md.",
      };
    }

    return {
      verified: true,
      message: `On-chain ledger state at ${ledgerData.contractAddress} matches this receipt (tx ${receipt.transactionId ?? "unknown"}).`,
    };
  }
}
