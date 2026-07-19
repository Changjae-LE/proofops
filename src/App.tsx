import { useCallback, useMemo, useState } from "react";
import type { JsonValue } from "./lib/canonicalize";
import { analyzeIncident } from "./lib/analyzer";
import { commitEvidence } from "./lib/hashing";
import { countSensitiveFields } from "./lib/redaction";
import { parseIncidentUpload } from "./lib/validation";
import {
  verifyEvidenceAgainstReceipt,
  type EvidenceVerification,
  type VerificationReceipt,
} from "./lib/receipt";
import { reportMetricEvent } from "./lib/metricsClient";
import { getProofProvider } from "./midnight/providerFactory";
import { isAnalysisSuccess, type AnalysisResult, type IncidentDocument } from "./types/incident";

import { IncidentUploader } from "./components/IncidentUploader";
import { AnalysisResultView } from "./components/AnalysisResult";
import { PrivacyPanel } from "./components/PrivacyPanel";
import { ProofReceiptView } from "./components/ProofReceipt";
import { VerificationPanel } from "./components/VerificationPanel";
import { SystemStatus } from "./components/SystemStatus";

const SAMPLE_URL = "/samples/imds-role-use-incident.json";
const TAMPER_REPLACEMENT_IP = "198.51.100.200";

export type AppStatus =
  | "idle"
  | "loading-sample"
  | "analyzing"
  | "analysis-complete"
  | "generating-receipt"
  | "receipt-confirmed"
  | "receipt-failed"
  | "verifying"
  | "verification-passed"
  | "verification-failed";

export interface TamperInfo {
  fieldPath: string;
  oldValue: string;
  newValue: string;
}

export type VerificationDisplay = EvidenceVerification & { tamperInfo: TamperInfo | null };

const BUSY_STATUSES: ReadonlySet<AppStatus> = new Set([
  "loading-sample",
  "analyzing",
  "generating-receipt",
  "verifying",
]);

export default function App() {
  const [status, setStatus] = useState<AppStatus>("idle");
  const [incident, setIncident] = useState<IncidentDocument | null>(null);
  const [incidentSourceLabel, setIncidentSourceLabel] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [evidenceCommitment, setEvidenceCommitment] = useState<string | null>(null);
  const [sensitiveFieldCount, setSensitiveFieldCount] = useState<number>(0);

  const [receipt, setReceipt] = useState<VerificationReceipt | null>(null);
  const [receiptWarning, setReceiptWarning] = useState<string | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);

  const [verification, setVerification] = useState<VerificationDisplay | null>(null);

  const provider = useMemo(() => getProofProvider(), []);
  const busy = BUSY_STATUSES.has(status);

  const resetDownstream = useCallback(() => {
    setAnalysis(null);
    setEvidenceCommitment(null);
    setSensitiveFieldCount(0);
    setReceipt(null);
    setReceiptWarning(null);
    setReceiptError(null);
    setVerification(null);
  }, []);

  const applyIncident = useCallback(
    (doc: IncidentDocument, sourceLabel: string) => {
      setIncident(doc);
      setIncidentSourceLabel(sourceLabel);
      setLoadError(null);
      resetDownstream();
      setStatus("idle");
    },
    [resetDownstream]
  );

  const handleLoadSample = useCallback(async () => {
    setStatus("loading-sample");
    setLoadError(null);
    try {
      const res = await fetch(SAMPLE_URL);
      if (!res.ok) {
        throw new Error(`Failed to load the demo incident (HTTP ${res.status}).`);
      }
      const text = await res.text();
      const result = parseIncidentUpload(text);
      if (!result.ok) {
        throw new Error(result.error);
      }
      applyIncident(result.data, "Bundled demo incident");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load the demo incident.");
      setStatus("idle");
    }
  }, [applyIncident]);

  const handleUpload = useCallback(
    (file: File) => {
      setStatus("loading-sample");
      setLoadError(null);
      const reader = new FileReader();
      reader.onload = () => {
        const text = typeof reader.result === "string" ? reader.result : "";
        const result = parseIncidentUpload(text);
        if (!result.ok) {
          setLoadError(result.error);
          setStatus("idle");
          return;
        }
        applyIncident(result.data, `Uploaded file: ${file.name}`);
      };
      reader.onerror = () => {
        setLoadError("Failed to read the uploaded file.");
        setStatus("idle");
      };
      reader.readAsText(file);
    },
    [applyIncident]
  );

  const handleAnalyze = useCallback(async () => {
    if (!incident) return;
    setStatus("analyzing");
    try {
      const result = analyzeIncident(incident);
      const commitment = await commitEvidence(incident as unknown as JsonValue);
      setAnalysis(result);
      setEvidenceCommitment(commitment);
      setSensitiveFieldCount(countSensitiveFields(incident));
      setReceipt(null);
      setReceiptWarning(null);
      setReceiptError(null);
      setVerification(null);
      setStatus("analysis-complete");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Analysis failed unexpectedly.");
      setStatus("idle");
    }
  }, [incident]);

  const handleGenerateReceipt = useCallback(async () => {
    if (!incident || !analysis || !isAnalysisSuccess(analysis)) return;
    setStatus("generating-receipt");
    setReceiptError(null);
    try {
      const result = await provider.createReceipt({
        analysis,
        evidence: incident as unknown as JsonValue,
        responseMinutes: analysis.policy.responseMinutes,
      });
      setReceipt(result.receipt);
      setReceiptWarning(result.warning ?? null);
      setVerification(null);
      setStatus(
        result.receipt.status === "MIDNIGHT_FAILED" ? "receipt-failed" : "receipt-confirmed"
      );
      reportMetricEvent("receipt_created");
    } catch (err) {
      setReceiptError(
        err instanceof Error ? err.message : "Failed to generate the verification receipt."
      );
      setStatus("receipt-failed");
    }
  }, [incident, analysis, provider]);

  const buildTamperedEvidence = useCallback((): {
    evidence: IncidentDocument;
    info: TamperInfo;
  } | null => {
    if (!incident) return null;
    const clone = structuredClone(incident);
    const preferredId =
      analysis && isAnalysisSuccess(analysis) ? analysis.matchedEvents.roleUseEventId : undefined;
    const target = clone.events.find((e) => e.eventId === preferredId) ?? clone.events[0];
    if (!target) return null;
    const oldValue = String(target.sourceIPAddress ?? "(none)");
    target.sourceIPAddress = TAMPER_REPLACEMENT_IP;
    return {
      evidence: clone,
      info: {
        fieldPath: `events[eventId="${target.eventId}"].sourceIPAddress`,
        oldValue,
        newValue: TAMPER_REPLACEMENT_IP,
      },
    };
  }, [incident, analysis]);

  const handleVerify = useCallback(
    async (tamper: boolean) => {
      if (!incident || !receipt) return;
      setStatus("verifying");
      try {
        let evidenceToCheck: JsonValue;
        let tamperInfo: TamperInfo | null = null;
        if (tamper) {
          const tampered = buildTamperedEvidence();
          if (!tampered) {
            throw new Error("Unable to construct a tampered evidence sample.");
          }
          evidenceToCheck = tampered.evidence as unknown as JsonValue;
          tamperInfo = tampered.info;
        } else {
          evidenceToCheck = incident as unknown as JsonValue;
        }

        const result = await verifyEvidenceAgainstReceipt(receipt, evidenceToCheck);
        setVerification({ ...result, tamperInfo });
        setStatus(result.verified ? "verification-passed" : "verification-failed");
        reportMetricEvent(result.verified ? "verification_run" : "verification_failed");
      } catch (err) {
        setVerification({
          verified: false,
          currentCommitment: "",
          expectedCommitment: receipt.evidenceCommitment,
          reason: err instanceof Error ? err.message : "Verification failed unexpectedly.",
          tamperInfo: null,
        });
        setStatus("verification-failed");
        reportMetricEvent("verification_failed");
      }
    },
    [incident, receipt, buildTamperedEvidence]
  );

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero-badge">SRE &amp; Security Operations</div>
        <h1>ProofOps</h1>
        <p className="hero-tagline">Prove incident response without exposing production logs.</p>
        <p className="hero-subtext">
          Raw evidence stays local.
          <br />
          Only a commitment and policy result are shared.
        </p>
      </header>

      <main className="app-main">
        <SystemStatus provider={provider} appStatus={status} />

        <IncidentUploader
          incident={incident}
          incidentSourceLabel={incidentSourceLabel}
          loadError={loadError}
          busy={busy}
          status={status}
          onLoadSample={handleLoadSample}
          onUpload={handleUpload}
          onAnalyze={handleAnalyze}
        />

        {analysis && (
          <AnalysisResultView
            analysis={analysis}
            evidenceCommitment={evidenceCommitment}
            sensitiveFieldCount={sensitiveFieldCount}
          />
        )}

        {incident && <PrivacyPanel incident={incident} />}

        {analysis && isAnalysisSuccess(analysis) && (
          <ProofReceiptView
            status={status}
            receipt={receipt}
            warning={receiptWarning}
            error={receiptError}
            onGenerate={handleGenerateReceipt}
            busy={busy}
          />
        )}

        {receipt && (
          <VerificationPanel
            status={status}
            verification={verification}
            onVerifyUnchanged={() => handleVerify(false)}
            onVerifyTampered={() => handleVerify(true)}
            busy={busy}
          />
        )}
      </main>

      <footer className="app-footer">
        <p>
          ProofOps is a hackathon MVP. Local demo receipts are not zero-knowledge proofs and are not
          submitted to any blockchain unless the Midnight provider is configured and connected.
        </p>
      </footer>
    </div>
  );
}
