import type { JsonValue } from "../lib/canonicalize";
import type { VerificationReceipt } from "../lib/receipt";
import type { AnalysisSuccess } from "../types/incident";

export type ProviderMode = "local" | "midnight";

export interface ProviderStatus {
  name: string;
  network: string;
  mode: ProviderMode;
  ready: boolean;
  message: string;
  /** Only set once a wallet session has actually been established server-side. */
  walletConnected?: boolean;
  /** Only set once a contract has actually been deployed or joined. */
  contractAddress?: string | null;
}

export interface CreateProofRequest {
  analysis: AnalysisSuccess;
  evidence: JsonValue;
  /** Private witness input: the actual response time in minutes. Never leaves the client. */
  responseMinutes: number;
}

export interface ProofProviderResult {
  receipt: VerificationReceipt;
  warning?: string;
}

export interface ProofVerificationResult {
  verified: boolean;
  message: string;
}

/**
 * Abstraction over "where the verification receipt actually comes from". Exactly one
 * implementation is active at a time, selected by providerFactory based on
 * VITE_PROOF_PROVIDER. This lets the rest of the app (UI, hashing, redaction, analysis)
 * stay fully functional even when Midnight network infrastructure is unavailable.
 */
export interface ProofProvider {
  readonly name: string;
  readonly network: string;

  getStatus(): Promise<ProviderStatus>;

  createReceipt(request: CreateProofRequest): Promise<ProofProviderResult>;

  verifyReceipt(receipt: VerificationReceipt): Promise<ProofVerificationResult>;

  /** Only implemented by providers backed by a real wallet (e.g. MidnightProofProvider). */
  connectWallet?(): Promise<{ network: string; contractAddress: string | null; coinPublicKey: string }>;

  /** Only implemented by providers that can deploy a new on-chain contract. */
  deployContract?(): Promise<{ network: string; contractAddress: string }>;
}
