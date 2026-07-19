import { describe, expect, it } from "vitest";
import { analyzeIncident } from "../src/lib/analyzer";
import { isAnalysisSuccess } from "../src/types/incident";
import { cloneIncident, loadSampleIncident } from "./fixtures";

describe("analyzeIncident", () => {
  it("correctly detects the bundled IMDS role-use scenario", () => {
    const incident = loadSampleIncident();
    const result = analyzeIncident(incident);

    expect(isAnalysisSuccess(result)).toBe(true);
    if (!isAnalysisSuccess(result)) return;

    expect(result.ruleId).toBe("AWS-IMDS-ROLE-USE-001");
    expect(result.incidentType).toBe("EC2 IMDS Credential Access Followed by Role Use");
    expect(result.severity).toBe("HIGH");
    expect(result.detectionConfidence).toBe("HIGH");
    expect(result.policy.limitMinutes).toBe(15);
    expect(result.policy.responseMinutes).toBe(8);
    expect(result.policy.satisfied).toBe(true);
    expect(result.eventsAnalyzed).toBe(incident.events.length);
  });

  it("returns a safe NOT_DETECTED result when events are missing", () => {
    const incident = loadSampleIncident();
    incident.events = [];

    const result = analyzeIncident(incident);
    expect(result.status).toBe("NOT_DETECTED");
  });

  it("returns a safe NOT_DETECTED result when the event chain is out of chronological order", () => {
    const incident = cloneIncident(loadSampleIncident());
    const imdsEvent = incident.events.find((e) => e.eventId === "evt-001");
    const credentialEvent = incident.events.find((e) => e.eventId === "evt-002");
    if (!imdsEvent || !credentialEvent) throw new Error("fixture missing expected events");

    // Swap timestamps so credential retrieval appears to happen before IMDS access.
    const swap = imdsEvent.eventTime;
    imdsEvent.eventTime = credentialEvent.eventTime;
    credentialEvent.eventTime = swap;

    const result = analyzeIncident(incident);
    expect(result.status).toBe("NOT_DETECTED");
  });

  it("computes an 8-minute response time for the bundled scenario", () => {
    const result = analyzeIncident(loadSampleIncident());
    if (!isAnalysisSuccess(result)) throw new Error("expected detection");
    expect(result.policy.responseMinutes).toBe(8);
  });

  it("satisfies the 15-minute policy at exactly 8 minutes", () => {
    const result = analyzeIncident(loadSampleIncident());
    if (!isAnalysisSuccess(result)) throw new Error("expected detection");
    expect(result.policy.satisfied).toBe(true);
  });

  it("satisfies the 15-minute policy at exactly 15 minutes", () => {
    const incident = cloneIncident(loadSampleIncident());
    const detected = new Date(incident.detection.detectedAt).getTime();
    incident.containment.containedAt = new Date(detected + 15 * 60_000).toISOString();

    const result = analyzeIncident(incident);
    if (!isAnalysisSuccess(result)) throw new Error("expected detection");
    expect(result.policy.responseMinutes).toBe(15);
    expect(result.policy.satisfied).toBe(true);
  });

  it("fails the 15-minute policy at 16 minutes", () => {
    const incident = cloneIncident(loadSampleIncident());
    const detected = new Date(incident.detection.detectedAt).getTime();
    incident.containment.containedAt = new Date(detected + 16 * 60_000).toISOString();

    const result = analyzeIncident(incident);
    if (!isAnalysisSuccess(result)) throw new Error("expected detection");
    expect(result.policy.responseMinutes).toBe(16);
    expect(result.policy.satisfied).toBe(false);
  });
});
