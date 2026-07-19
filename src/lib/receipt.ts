import type { JsonValue } from "./canonicalize";
import { commitEvidence, sha256Hex } from "./hashing";
import type { AnalysisSuccess } from "../types/incident";

export const RECEIPT_VERSION = 1 as const;

export type ReceiptStatus =
  "LOCAL_DEMO" | "MIDNIGHT_PENDING" | "MIDNIGHT_CONFIRMED" | "MIDNIGHT_FAILED";

/**
 * A privacy-preserving verification receipt. Contains only public commitments and the
 * policy result — never the raw evidence, private response time, or any sensitive field.
 */
export interface VerificationReceipt {
  receiptVersion: typeof RECEIPT_VERSION;
  incidentId: string;
  incidentIdHash: string;
  evidenceCommitment: string;
  ruleId: string;
  policyId: string;
  policyLimitMinutes: number;
  policySatisfied: boolean;
  provider: string;
  network: string;
  createdAt: string;
  /** Only present when a real on-chain transaction actually exists. */
  transactionId?: string;
  /** Only present when a real deployed contract address actually exists. */
  contractAddress?: string;
  status: ReceiptStatus;
}

export interface ReceiptCoreFields {
  receiptVersion: typeof RECEIPT_VERSION;
  incidentId: string;
  incidentIdHash: string;
  evidenceCommitment: string;
  ruleId: string;
  policyId: string;
  policyLimitMinutes: number;
  policySatisfied: boolean;
  createdAt: string;
}

/**
 * Builds the provider-independent core of a receipt: the public commitments and the
 * policy result. Providers (local demo or Midnight) wrap this with their own
 * provider/network/status/transaction fields.
 */
export async function buildReceiptCore(
  analysis: AnalysisSuccess,
  evidence: JsonValue
): Promise<ReceiptCoreFields> {
  const [incidentIdHash, evidenceCommitment] = await Promise.all([
    sha256Hex(analysis.incidentId),
    commitEvidence(evidence),
  ]);

  return {
    receiptVersion: RECEIPT_VERSION,
    incidentId: analysis.incidentId,
    incidentIdHash,
    evidenceCommitment,
    ruleId: analysis.ruleId,
    policyId: analysis.policy.policyId,
    policyLimitMinutes: analysis.policy.limitMinutes,
    policySatisfied: analysis.policy.satisfied,
    createdAt: new Date().toISOString(),
  };
}

export interface EvidenceVerification {
  verified: boolean;
  currentCommitment: string;
  expectedCommitment: string;
  reason?: string;
}

/**
 * Recomputes the commitment of a (possibly tampered) evidence document and compares it
 * against the commitment recorded in a receipt. This is the core tamper-detection check:
 * any change to the evidence, however small, changes the SHA-256 commitment.
 */
export async function verifyEvidenceAgainstReceipt(
  receipt: Pick<VerificationReceipt, "evidenceCommitment">,
  evidence: JsonValue
): Promise<EvidenceVerification> {
  const currentCommitment = await commitEvidence(evidence);
  const verified = currentCommitment === receipt.evidenceCommitment;
  return {
    verified,
    currentCommitment,
    expectedCommitment: receipt.evidenceCommitment,
    reason: verified ? undefined : "Evidence has changed since the receipt was created.",
  };
}

/**
 * Basic structural validation for a VerificationReceipt, used before trusting a receipt
 * loaded from storage or pasted by a user.
 */
export function isValidReceiptShape(value: unknown): value is VerificationReceipt {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const r = value as Record<string, unknown>;
  return (
    r.receiptVersion === RECEIPT_VERSION &&
    typeof r.incidentId === "string" &&
    typeof r.incidentIdHash === "string" &&
    typeof r.evidenceCommitment === "string" &&
    typeof r.ruleId === "string" &&
    typeof r.policyId === "string" &&
    typeof r.policyLimitMinutes === "number" &&
    typeof r.policySatisfied === "boolean" &&
    typeof r.provider === "string" &&
    typeof r.network === "string" &&
    typeof r.createdAt === "string" &&
    typeof r.status === "string"
  );
}
