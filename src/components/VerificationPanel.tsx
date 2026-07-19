import type { AppStatus, VerificationDisplay } from "../App";

interface VerificationPanelProps {
  status: AppStatus;
  verification: VerificationDisplay | null;
  busy: boolean;
  onVerifyUnchanged: () => void;
  onVerifyTampered: () => void;
}

export function VerificationPanel({
  status,
  verification,
  busy,
  onVerifyUnchanged,
  onVerifyTampered,
}: VerificationPanelProps) {
  return (
    <section className="card" aria-labelledby="verify-heading">
      <h2 id="verify-heading">5. Verify</h2>
      <p className="card-description">
        Recompute the evidence commitment and compare it against the receipt. A single changed field
        is enough to break the match.
      </p>

      <div className="button-row">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onVerifyUnchanged}
          disabled={busy}
        >
          {status === "verifying" ? "Verifying…" : "Verify Current Evidence"}
        </button>
        <button
          type="button"
          className="btn btn-danger-outline"
          onClick={onVerifyTampered}
          disabled={busy}
        >
          Tamper a Field &amp; Verify
        </button>
      </div>

      <div aria-live="polite" className="verification-live-region">
        {verification && (
          <div
            className={`verification-result ${verification.verified ? "verification-pass" : "verification-fail"}`}
          >
            <p className="verification-headline">
              {verification.verified ? "VERIFIED" : "VERIFICATION FAILED"}
            </p>
            {!verification.verified && (
              <p className="verification-reason">
                {verification.reason ?? "Evidence has changed since the receipt was created."}
              </p>
            )}

            {verification.tamperInfo && (
              <dl className="fact-grid">
                <div className="fact fact-wide">
                  <dt>Tampered field</dt>
                  <dd className="mono">{verification.tamperInfo.fieldPath}</dd>
                </div>
                <div className="fact">
                  <dt>Original value</dt>
                  <dd className="mono">{verification.tamperInfo.oldValue}</dd>
                </div>
                <div className="fact">
                  <dt>Tampered value</dt>
                  <dd className="mono">{verification.tamperInfo.newValue}</dd>
                </div>
              </dl>
            )}

            <dl className="fact-grid">
              <div className="fact fact-wide">
                <dt>Receipt commitment</dt>
                <dd className="mono commitment">{verification.expectedCommitment}</dd>
              </div>
              <div className="fact fact-wide">
                <dt>Recomputed commitment</dt>
                <dd className="mono commitment">{verification.currentCommitment}</dd>
              </div>
            </dl>
          </div>
        )}
      </div>
    </section>
  );
}
