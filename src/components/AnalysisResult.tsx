import { isAnalysisSuccess, type AnalysisResult } from "../types/incident";

interface AnalysisResultProps {
  analysis: AnalysisResult;
  evidenceCommitment: string | null;
  sensitiveFieldCount: number;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toISOString().replace("T", " ").replace("Z", " UTC");
}

export function AnalysisResultView({
  analysis,
  evidenceCommitment,
  sensitiveFieldCount,
}: AnalysisResultProps) {
  if (!isAnalysisSuccess(analysis)) {
    return (
      <section className="card" aria-labelledby="analysis-heading">
        <h2 id="analysis-heading">2. Analysis Result</h2>
        <p className="status-text status-error" role="status">
          Incident type not detected: {analysis.reason}
        </p>
        <dl className="fact-grid">
          <div className="fact">
            <dt>Events analyzed</dt>
            <dd>{analysis.eventsAnalyzed}</dd>
          </div>
        </dl>
      </section>
    );
  }

  return (
    <section className="card" aria-labelledby="analysis-heading">
      <h2 id="analysis-heading">2. Analysis Result</h2>
      <div className="button-row">
        <span className="badge badge-severity-high">{analysis.severity}</span>
        <span className={`badge ${analysis.policy.satisfied ? "badge-success" : "badge-danger"}`}>
          Policy {analysis.policy.satisfied ? "Satisfied" : "Violated"}
        </span>
        <span className="badge badge-neutral">Confidence: {analysis.detectionConfidence}</span>
      </div>

      <dl className="fact-grid">
        <div className="fact">
          <dt>Incident type</dt>
          <dd>{analysis.incidentType}</dd>
        </div>
        <div className="fact">
          <dt>Rule ID</dt>
          <dd className="mono">{analysis.ruleId}</dd>
        </div>
        <div className="fact">
          <dt>Detection timestamp</dt>
          <dd className="mono">{formatTimestamp(analysis.detectedAt)}</dd>
        </div>
        <div className="fact">
          <dt>Containment timestamp</dt>
          <dd className="mono">{formatTimestamp(analysis.containedAt)}</dd>
        </div>
        <div className="fact">
          <dt>Response time</dt>
          <dd>{analysis.policy.responseMinutes} minutes</dd>
        </div>
        <div className="fact">
          <dt>Policy limit</dt>
          <dd>{analysis.policy.limitMinutes} minutes</dd>
        </div>
        <div className="fact">
          <dt>Policy satisfied</dt>
          <dd>{analysis.policy.satisfied ? "true" : "false"}</dd>
        </div>
        <div className="fact">
          <dt>Sensitive fields found</dt>
          <dd>{sensitiveFieldCount}</dd>
        </div>
        <div className="fact">
          <dt>Events analyzed</dt>
          <dd>{analysis.eventsAnalyzed}</dd>
        </div>
        <div className="fact fact-wide">
          <dt>Evidence commitment (SHA-256)</dt>
          <dd className="mono commitment">{evidenceCommitment ?? "computing…"}</dd>
        </div>
      </dl>
    </section>
  );
}
