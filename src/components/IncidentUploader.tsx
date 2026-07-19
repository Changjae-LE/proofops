import { useRef, type ChangeEvent } from "react";
import type { AppStatus } from "../App";
import { MAX_INCIDENT_UPLOAD_BYTES } from "../lib/validation";
import type { IncidentDocument } from "../types/incident";

interface IncidentUploaderProps {
  incident: IncidentDocument | null;
  incidentSourceLabel: string | null;
  loadError: string | null;
  busy: boolean;
  status: AppStatus;
  onLoadSample: () => void;
  onUpload: (file: File) => void;
  onAnalyze: () => void;
}

export function IncidentUploader({
  incident,
  incidentSourceLabel,
  loadError,
  busy,
  status,
  onLoadSample,
  onUpload,
  onAnalyze,
}: IncidentUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onUpload(file);
    }
    event.target.value = "";
  };

  return (
    <section className="card" aria-labelledby="incident-input-heading">
      <h2 id="incident-input-heading">1. Incident Input</h2>
      <p className="card-description">
        Load the bundled demo incident or upload your own JSON evidence bundle (max{" "}
        {Math.round(MAX_INCIDENT_UPLOAD_BYTES / 1024)} KB). The file never leaves your browser.
      </p>

      <div className="button-row">
        <button type="button" className="btn btn-primary" onClick={onLoadSample} disabled={busy}>
          {status === "loading-sample" ? "Loading…" : "Load Demo Incident"}
        </button>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
        >
          Upload JSON
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleFileChange}
          className="visually-hidden"
          aria-label="Upload incident JSON file"
        />

        <button
          type="button"
          className="btn btn-accent"
          onClick={onAnalyze}
          disabled={busy || !incident}
        >
          {status === "analyzing" ? "Analyzing…" : "Analyze Privately"}
        </button>
      </div>

      {loadError && (
        <p className="status-text status-error" role="alert">
          {loadError}
        </p>
      )}

      {incident && !loadError && (
        <div className="incident-summary" data-testid="incident-summary">
          <span className="badge badge-neutral">Loaded</span>
          <span>{incidentSourceLabel}</span>
          <span className="muted">
            {incident.incidentId} · {incident.events.length} events
          </span>
        </div>
      )}
    </section>
  );
}
