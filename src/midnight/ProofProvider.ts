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
}
