import { useCallback, useEffect, useState } from "react";
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

type WalletAction = "idle" | "connecting" | "deploying";

export function SystemStatus({ provider, appStatus }: SystemStatusProps) {
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null);
  const [backend, setBackend] = useState<BackendHealth>({ healthy: null, ready: null });
  const [walletAction, setWalletAction] = useState<WalletAction>("idle");
  const [walletError, setWalletError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    provider.getStatus().then((s) => {
      if (!cancelled) setProviderStatus(s);
    });
    return () => {
      cancelled = true;
    };
  }, [provider, refreshTick]);

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

  const refresh = useCallback(() => setRefreshTick((t) => t + 1), []);

  const handleConnect = useCallback(async () => {
    if (!provider.connectWallet) return;
    setWalletAction("connecting");
    setWalletError(null);
    try {
      await provider.connectWallet();
      refresh();
    } catch (err) {
      setWalletError(err instanceof Error ? err.message : "Wallet connection failed.");
    } finally {
      setWalletAction("idle");
    }
  }, [provider, refresh]);

  const handleDeploy = useCallback(async () => {
    if (!provider.deployContract) return;
    setWalletAction("deploying");
    setWalletError(null);
    try {
      await provider.deployContract();
      refresh();
    } catch (err) {
      setWalletError(err instanceof Error ? err.message : "Contract deployment failed.");
    } finally {
      setWalletAction("idle");
    }
  }, [provider, refresh]);

  const isMidnight = providerStatus?.mode === "midnight";
  const modeLabel = isMidnight
    ? providerStatus?.ready
      ? "MIDNIGHT NETWORK"
      : "MIDNIGHT NETWORK NOT READY"
    : "LOCAL DEMO MODE";
  const modeBadgeClass = isMidnight ? (providerStatus?.ready ? "badge-neutral" : "badge-danger") : "badge-amber";

  // "Connected" here means the server-side wallet session has been established and is
  // reachable, as reported by getStatus() - never inferred client-side.
  const walletConnected = isMidnight && Boolean(providerStatus?.walletConnected);
  const contractAddress = providerStatus?.contractAddress ?? null;

  return (
    <section className="card system-status" aria-label="System status">
      <div className="button-row">
        <span className={`badge ${modeBadgeClass}`}>{modeLabel}</span>
        <span className="badge badge-neutral">App: {APP_STATUS_LABELS[appStatus]}</span>
        <span className={`badge ${backend.healthy ? "badge-success" : "badge-danger"}`}>
          API:{" "}
          {backend.healthy === null ? "checking…" : backend.healthy ? "healthy" : "unreachable"}
        </span>
        {isMidnight && (
          <span className={`badge ${walletConnected ? "badge-success" : "badge-amber"}`}>
            Wallet: {walletConnected ? "connected" : "not connected"}
          </span>
        )}
      </div>
      {providerStatus && <p className="status-text muted">{providerStatus.message}</p>}

      {isMidnight && (
        <div className="button-row">
          {provider.connectWallet && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleConnect}
              disabled={walletAction !== "idle"}
            >
              {walletAction === "connecting" ? "Connecting…" : "Connect Wallet"}
            </button>
          )}
          {provider.deployContract && !contractAddress && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleDeploy}
              disabled={walletAction !== "idle" || !walletConnected}
            >
              {walletAction === "deploying" ? "Deploying…" : "Deploy Contract"}
            </button>
          )}
          {contractAddress && <span className="badge badge-neutral mono">Contract: {contractAddress}</span>}
        </div>
      )}
      {walletError && (
        <p className="status-text status-error" role="alert">
          {walletError}
        </p>
      )}
    </section>
  );
}
