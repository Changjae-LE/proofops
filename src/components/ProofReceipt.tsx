import type { AppStatus } from "../App";
import type { VerificationReceipt } from "../lib/receipt";

interface ProofReceiptProps {
  status: AppStatus;
  receipt: VerificationReceipt | null;
  warning: string | null;
  error: string | null;
  busy: boolean;
  onGenerate: () => void;
}

const STATUS_BADGE_CLASS: Record<VerificationReceipt["status"], string> = {
  LOCAL_DEMO: "badge-amber",
  MIDNIGHT_PENDING: "badge-amber",
  MIDNIGHT_CONFIRMED: "badge-success",
  MIDNIGHT_FAILED: "badge-danger",
};

export function ProofReceiptView({
  status,
  receipt,
  warning,
  error,
  busy,
  onGenerate,
}: ProofReceiptProps) {
  return (
    <section className="card" aria-labelledby="receipt-heading">
      <h2 id="receipt-heading">4. Verification Receipt</h2>
      <p className="card-description">
        The receipt contains only commitments and the policy result - never the raw log, IP
        addresses, ARNs, credentials, or the private response time.
      </p>

      <div className="button-row">
        <button type="button" className="btn btn-primary" onClick={onGenerate} disabled={busy}>
          {status === "generating-receipt" ? "Generating…" : "Generate Verification Receipt"}
        </button>
      </div>

      {error && (
        <p className="status-text status-error" role="alert">
          {error}
        </p>
      )}

      {receipt && (
        <>
          <div className="button-row">
            <span className={`badge ${STATUS_BADGE_CLASS[receipt.status]}`}>{receipt.status}</span>
            <span className="badge badge-neutral">{receipt.provider}</span>
            <span className="badge badge-neutral">{receipt.network}</span>
          </div>

          {warning && <p className="status-text status-amber">{warning}</p>}

          <dl className="fact-grid">
            <div className="fact">
              <dt>Receipt version</dt>
              <dd>{receipt.receiptVersion}</dd>
            </div>
            <div className="fact">
              <dt>Incident ID</dt>
              <dd className="mono">{receipt.incidentId}</dd>
            </div>
            <div className="fact fact-wide">
              <dt>Incident ID hash</dt>
              <dd className="mono commitment">{receipt.incidentIdHash}</dd>
            </div>
            <div className="fact fact-wide">
              <dt>Evidence commitment (SHA-256)</dt>
              <dd className="mono commitment">{receipt.evidenceCommitment}</dd>
            </div>
            <div className="fact">
              <dt>Rule ID</dt>
              <dd className="mono">{receipt.ruleId}</dd>
            </div>
            <div className="fact">
              <dt>Policy ID</dt>
              <dd className="mono">{receipt.policyId}</dd>
            </div>
            <div className="fact">
              <dt>Policy limit</dt>
              <dd>{receipt.policyLimitMinutes} minutes</dd>
            </div>
            <div className="fact">
              <dt>Policy satisfied</dt>
              <dd>{receipt.policySatisfied ? "true" : "false"}</dd>
            </div>
            <div className="fact">
              <dt>Verification provider</dt>
              <dd>{receipt.provider}</dd>
            </div>
            <div className="fact">
              <dt>Network</dt>
              <dd>{receipt.network}</dd>
            </div>
            <div className="fact">
              <dt>Created at</dt>
              <dd className="mono">{receipt.createdAt}</dd>
            </div>
            <div className="fact">
              <dt>Receipt status</dt>
              <dd>{receipt.status}</dd>
            </div>
            {receipt.transactionId && (
              <div className="fact fact-wide">
                <dt>Transaction ID</dt>
                <dd className="mono commitment">{receipt.transactionId}</dd>
              </div>
            )}
            {receipt.contractAddress && (
              <div className="fact fact-wide">
                <dt>Contract address</dt>
                <dd className="mono commitment">{receipt.contractAddress}</dd>
              </div>
            )}
          </dl>
        </>
      )}
    </section>
  );
}
