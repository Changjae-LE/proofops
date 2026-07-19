import { buildReceiptCore, isValidReceiptShape, type VerificationReceipt } from "../lib/receipt";
import type {
  CreateProofRequest,
  ProofProvider,
  ProofProviderResult,
  ProofVerificationResult,
  ProviderStatus,
} from "./ProofProvider";

/**
 * Local, wallet-free proof provider. Produces LOCAL_DEMO receipts that prove nothing
 * cryptographically beyond "this SHA-256 commitment was computed from this evidence" -
 * it never claims to generate a zero-knowledge proof or to touch a blockchain. This
 * keeps ProofOps fully demonstrable even when Midnight network infrastructure is
 * unavailable.
 */
export class LocalDemoProofProvider implements ProofProvider {
  readonly name = "local-demo";
  readonly network = "local-demo";

  async getStatus(): Promise<ProviderStatus> {
    return {
      name: this.name,
      network: this.network,
      mode: "local",
      ready: true,
      message: "Local demo mode: receipts are computed in-browser and are not on-chain.",
    };
  }

  async createReceipt(request: CreateProofRequest): Promise<ProofProviderResult> {
    const core = await buildReceiptCore(request.analysis, request.evidence);
    return {
      receipt: {
        ...core,
        provider: this.name,
        network: this.network,
        status: "LOCAL_DEMO",
      },
      warning:
        "This is a local demo receipt. It is not a zero-knowledge proof and was not submitted to any blockchain.",
    };
  }

  async verifyReceipt(receipt: VerificationReceipt): Promise<ProofVerificationResult> {
    if (!isValidReceiptShape(receipt)) {
      return { verified: false, message: "Receipt does not match the expected schema." };
    }
    if (receipt.status !== "LOCAL_DEMO") {
      return {
        verified: false,
        message: `Local demo provider cannot verify a receipt with status "${receipt.status}".`,
      };
    }
    return { verified: true, message: "Local demo receipt schema and status are valid." };
  }
}
