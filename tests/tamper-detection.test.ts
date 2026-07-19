import { describe, expect, it } from "vitest";
import type { JsonValue } from "../src/lib/canonicalize";
import { buildReceiptCore, verifyEvidenceAgainstReceipt } from "../src/lib/receipt";
import { analyzeIncident } from "../src/lib/analyzer";
import { isAnalysisSuccess } from "../src/types/incident";
import { cloneIncident, loadSampleIncident } from "./fixtures";

describe("tamper detection", () => {
  it("verifies successfully when evidence is unchanged since the receipt was created", async () => {
    const incident = loadSampleIncident();
    const analysis = analyzeIncident(incident);
    if (!isAnalysisSuccess(analysis)) throw new Error("expected detection");

    const core = await buildReceiptCore(analysis, incident as unknown as JsonValue);
    const result = await verifyEvidenceAgainstReceipt(core, incident as unknown as JsonValue);

    expect(result.verified).toBe(true);
    expect(result.currentCommitment).toBe(result.expectedCommitment);
  });

  it("fails verification when a single event field is tampered with after the receipt was created", async () => {
    const incident = loadSampleIncident();
    const analysis = analyzeIncident(incident);
    if (!isAnalysisSuccess(analysis)) throw new Error("expected detection");

    const core = await buildReceiptCore(analysis, incident as unknown as JsonValue);

    const tampered = cloneIncident(incident);
    const roleUseEvent = tampered.events.find((e) => e.eventId === "evt-003");
    if (!roleUseEvent) throw new Error("fixture missing evt-003");
    roleUseEvent.sourceIPAddress = "198.51.100.200"; // single field changed post-hoc

    const result = await verifyEvidenceAgainstReceipt(core, tampered as unknown as JsonValue);

    expect(result.verified).toBe(false);
    expect(result.currentCommitment).not.toBe(result.expectedCommitment);
    expect(result.reason).toMatch(/changed/i);
  });
});
