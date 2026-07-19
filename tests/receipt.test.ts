import { describe, expect, it } from "vitest";
import { analyzeIncident } from "../src/lib/analyzer";
import { isValidReceiptShape } from "../src/lib/receipt";
import { LocalDemoProofProvider } from "../src/midnight/LocalDemoProofProvider";
import { isAnalysisSuccess } from "../src/types/incident";
import { loadSampleIncident } from "./fixtures";
import type { JsonValue } from "../src/lib/canonicalize";

describe("VerificationReceipt schema", () => {
  it("accepts a well-formed receipt", async () => {
    const incident = loadSampleIncident();
    const analysis = analyzeIncident(incident);
    if (!isAnalysisSuccess(analysis)) throw new Error("expected detection");

    const provider = new LocalDemoProofProvider();
    const { receipt } = await provider.createReceipt({
      analysis,
      evidence: incident as unknown as JsonValue,
      responseMinutes: analysis.policy.responseMinutes,
    });

    expect(isValidReceiptShape(receipt)).toBe(true);
  });

  it("rejects objects missing required fields", () => {
    expect(isValidReceiptShape({ incidentId: "INC-1" })).toBe(false);
    expect(isValidReceiptShape(null)).toBe(false);
    expect(isValidReceiptShape("not-a-receipt")).toBe(false);
  });
});

describe("LocalDemoProofProvider", () => {
  it("visibly marks every receipt it creates as LOCAL_DEMO, never as an on-chain proof", async () => {
    const incident = loadSampleIncident();
    const analysis = analyzeIncident(incident);
    if (!isAnalysisSuccess(analysis)) throw new Error("expected detection");

    const provider = new LocalDemoProofProvider();
    const result = await provider.createReceipt({
      analysis,
      evidence: incident as unknown as JsonValue,
      responseMinutes: analysis.policy.responseMinutes,
    });

    expect(result.receipt.status).toBe("LOCAL_DEMO");
    expect(result.receipt.provider).toBe("local-demo");
    expect(result.receipt.transactionId).toBeUndefined();
    expect(result.receipt.contractAddress).toBeUndefined();
    expect(result.warning).toMatch(/not.*(zero-knowledge|blockchain)/i);
  });
});
