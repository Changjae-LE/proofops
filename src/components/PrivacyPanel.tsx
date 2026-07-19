import { useMemo, useState } from "react";
import { redactEvidence } from "../lib/redaction";
import type { IncidentDocument } from "../types/incident";

interface PrivacyPanelProps {
  incident: IncidentDocument;
}

type Tab = "original" | "redacted";

export function PrivacyPanel({ incident }: PrivacyPanelProps) {
  const [tab, setTab] = useState<Tab>("redacted");
  const redacted = useMemo(() => redactEvidence(incident), [incident]);

  const activeDoc = tab === "original" ? incident : redacted;

  return (
    <section className="card" aria-labelledby="privacy-heading">
      <h2 id="privacy-heading">3. Privacy Preview</h2>
      <p className="card-description">
        ProofOps never sends this raw evidence anywhere. Compare the original incident against what
        a reviewer without access to production systems would see.
      </p>

      <div className="tab-list" role="tablist" aria-label="Evidence view">
        <button
          type="button"
          role="tab"
          id="tab-original"
          aria-selected={tab === "original"}
          aria-controls="tabpanel-evidence"
          className={`tab-button ${tab === "original" ? "tab-button-active" : ""}`}
          onClick={() => setTab("original")}
        >
          Original Evidence
        </button>
        <button
          type="button"
          role="tab"
          id="tab-redacted"
          aria-selected={tab === "redacted"}
          aria-controls="tabpanel-evidence"
          className={`tab-button ${tab === "redacted" ? "tab-button-active" : ""}`}
          onClick={() => setTab("redacted")}
        >
          Redacted Preview
        </button>
        {tab === "original" && (
          <span className="badge badge-danger" role="note">
            Contains sensitive data
          </span>
        )}
      </div>

      <div
        id="tabpanel-evidence"
        role="tabpanel"
        aria-labelledby={tab === "original" ? "tab-original" : "tab-redacted"}
        className="code-block"
      >
        <pre className="mono">{JSON.stringify(activeDoc, null, 2)}</pre>
      </div>
    </section>
  );
}
