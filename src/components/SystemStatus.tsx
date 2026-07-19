import { useEffect, useState } from "react";
import type { AppStatus } from "../App";
import type { ProofProvider, ProviderStatus } from "../midnight/ProofProvider";

interface SystemStatusProps {
  provider: ProofProvider;
  appStatus: AppStatus;
}

interface BackendHealth {
  healthy: boolean | null;
  ready: boolean | null;
}

const APP_STATUS_LABELS: Record<AppStatus, string> = {
  idle: "Idle",
  "loading-sample": "Loading incident…",
  analyzing: "Analyzing…",
  "analysis-complete": "Analysis complete",
  "generating-receipt": "Generating receipt…",
  "receipt-confirmed": "Receipt confirmed",
  "receipt-failed": "Receipt failed",
  verifying: "Verifying…",
  "verification-passed": "Verification passed",
  "verification-failed": "Verification failed",
};

export function SystemStatus({ provider, appStatus }: SystemStatusProps) {
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null);
  const [backend, setBackend] = useState<BackendHealth>({ healthy: null, ready: null });

  useEffect(() => {
    let cancelled = false;
    provider.getStatus().then((s) => {
      if (!cancelled) setProviderStatus(s);
    });
    return () => {
      cancelled = true;
    };
  }, [provider]);

  useEffect(() => {
    let cancelled = false;
    fetch("/healthz")
      .then((r) => {
        if (!cancelled) setBackend((prev) => ({ ...prev, healthy: r.ok }));
      })
      .catch(() => {
        if (!cancelled) setBackend((prev) => ({ ...prev, healthy: false }));
      });
    fetch("/readyz")
      .then((r) => {
        if (!cancelled) setBackend((prev) => ({ ...prev, ready: r.ok }));
      })
      .catch(() => {
        if (!cancelled) setBackend((prev) => ({ ...prev, ready: false }));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const modeLabel = providerStatus?.mode === "midnight" ? "MIDNIGHT NETWORK" : "LOCAL DEMO MODE";
  const modeBadgeClass = providerStatus?.mode === "midnight" ? "badge-neutral" : "badge-amber";

  return (
    <section className="card system-status" aria-label="System status">
      <div className="button-row">
        <span className={`badge ${modeBadgeClass}`}>{modeLabel}</span>
        <span className="badge badge-neutral">App: {APP_STATUS_LABELS[appStatus]}</span>
        <span className={`badge ${backend.healthy ? "badge-success" : "badge-danger"}`}>
          API:{" "}
          {backend.healthy === null ? "checking…" : backend.healthy ? "healthy" : "unreachable"}
        </span>
      </div>
      {providerStatus && <p className="status-text muted">{providerStatus.message}</p>}
    </section>
  );
}
