import { describe, expect, it } from "vitest";
import { redactEvidence } from "../src/lib/redaction";
import { loadSampleIncident } from "./fixtures";

describe("redactEvidence", () => {
  it("masks the documented AKIA example exactly", () => {
    const redacted = redactEvidence({ accessKeyId: "AKIAEXAMPLE1234" });
    expect(redacted.accessKeyId).toBe("AKIA********1234");
  });

  it("fully redacts highly sensitive fields", () => {
    const redacted = redactEvidence({
      sessionToken: "FwoGZXIvYXdzEXAMPLESESSIONTOKENabcdefghijklmnopqrstuvwxyz",
      password: "hunter2hunter2",
      secretAccessKey: "wJalrXUtnFEMIK7MDENGbPxRfiCYEXAMPLEKEY",
    });
    expect(redacted.sessionToken).toBe("[REDACTED]");
    expect(redacted.password).toBe("[REDACTED]");
    expect(redacted.secretAccessKey).toBe("[REDACTED]");
  });

  it("preserves non-sensitive fields untouched", () => {
    const redacted = redactEvidence({
      eventName: "ListObjects",
      eventSource: "s3.amazonaws.com",
      severity: "HIGH",
    });
    expect(redacted).toEqual({
      eventName: "ListObjects",
      eventSource: "s3.amazonaws.com",
      severity: "HIGH",
    });
  });

  it("redacts sensitive fields nested arbitrarily deep", () => {
    const redacted = redactEvidence({
      userIdentity: {
        type: "AssumedRole",
        arn: "arn:aws:sts::123456789012:assumed-role/prod-app-role/i-0a1b2c3d4e5f67890",
      },
    });
    expect(redacted.userIdentity.arn).not.toContain("123456789012");
    expect(redacted.userIdentity.type).toBe("AssumedRole");
  });

  it("redacts sensitive fields inside arrays of objects", () => {
    const redacted = redactEvidence({
      events: [
        { eventId: "evt-1", email: "analyst@example-corp.io" },
        { eventId: "evt-2", email: "other@example-corp.io" },
      ],
    });
    const [first, second] = redacted.events;
    expect(first?.eventId).toBe("evt-1");
    expect(first?.email).not.toBe("analyst@example-corp.io");
    expect(second?.email).not.toBe("other@example-corp.io");
  });

  it("does not mutate the original object", () => {
    const original = loadSampleIncident();
    const snapshot = JSON.parse(JSON.stringify(original));

    redactEvidence(original);

    expect(original).toEqual(snapshot);
  });

  it("redacts all documented sensitive fields present in the bundled sample incident", () => {
    const incident = loadSampleIncident();
    const redacted = redactEvidence(incident) as unknown as Record<string, unknown>;
    const serialized = JSON.stringify(redacted);

    expect(serialized).not.toContain("123456789012");
    expect(serialized).not.toContain("ASIAEXAMPLE7788");
    expect(serialized).not.toContain("FwoGZXIvYXdzEXAMPLESESSIONTOKEN");
    expect(serialized).not.toContain("priya.nair@example-corp.io");
    expect(serialized).not.toContain("203.0.113.77");
    expect(serialized).not.toContain("10.0.1.15");
  });
});
