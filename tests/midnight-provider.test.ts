import { describe, expect, it, vi, afterEach } from "vitest";
import { MidnightProofProvider } from "../src/midnight/MidnightProofProvider";
import { analyzeIncident } from "../src/lib/analyzer";
import { isAnalysisSuccess } from "../src/types/incident";
import { loadSampleIncident } from "./fixtures";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("MidnightProofProvider (network response parsing / confirmation handling)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("getStatus() reports ready:false when the server says Midnight is not configured", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, { configured: false, message: "Set MIDNIGHT_NETWORK to enable real Midnight mode." }),
      ),
    );

    const provider = new MidnightProofProvider();
    const status = await provider.getStatus();

    expect(status.ready).toBe(false);
    expect(status.mode).toBe("midnight");
    expect(status.walletConnected).toBeUndefined();
  });

  it("getStatus() only reports ready:true and a contract address once the server phase is 'ready'", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
          configured: true,
          network: "preprod",
          configuredContractAddress: null,
          phase: "ready",
          contractAddress: "contract-abc",
        }),
      ),
    );

    const provider = new MidnightProofProvider();
    const status = await provider.getStatus();

    expect(status.ready).toBe(true);
    expect(status.walletConnected).toBe(true);
    expect(status.contractAddress).toBe("contract-abc");
  });

  it("getStatus() does not report ready or a contract address while still initializing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
          configured: true,
          network: "preprod",
          configuredContractAddress: null,
          phase: "initializing",
        }),
      ),
    );

    const provider = new MidnightProofProvider();
    const status = await provider.getStatus();

    expect(status.ready).toBe(false);
    expect(status.contractAddress).toBeNull();
  });

  it("createReceipt() throws the server's real error and never fabricates a receipt when the policy assertion fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(502, { error: "response time exceeds the policy containment limit" }),
      ),
    );

    const incident = loadSampleIncident();
    const analysis = analyzeIncident(incident);
    if (!isAnalysisSuccess(analysis)) throw new Error("fixture incident should analyze successfully");

    const provider = new MidnightProofProvider();
    await expect(
      provider.createReceipt({ analysis, evidence: incident as never, responseMinutes: 16 }),
    ).rejects.toThrow(/policy containment limit/);
  });

  it("createReceipt() only returns MIDNIGHT_CONFIRMED with a real txId once the server responds 200", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        status: "MIDNIGHT_CONFIRMED",
        network: "preprod",
        contractAddress: "contract-xyz",
        txId: "0xrealtx",
        blockHeight: 7,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const incident = loadSampleIncident();
    const analysis = analyzeIncident(incident);
    if (!isAnalysisSuccess(analysis)) throw new Error("fixture incident should analyze successfully");

    const provider = new MidnightProofProvider();
    const result = await provider.createReceipt({
      analysis,
      evidence: incident as never,
      responseMinutes: analysis.policy.responseMinutes,
    });

    expect(result.receipt.status).toBe("MIDNIGHT_CONFIRMED");
    expect(result.receipt.transactionId).toBe("0xrealtx");
    expect(result.receipt.contractAddress).toBe("contract-xyz");

    // responseMinutes must have been sent as the private witness input, never as part of
    // any field that could end up on the public ledger.
    const [, requestInit] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
    const sentBody = JSON.parse(requestInit.body as string);
    expect(sentBody.responseMinutes).toBe(analysis.policy.responseMinutes);
    expect(sentBody).not.toHaveProperty("incidentEvents");
  });

  it("verifyReceipt() reports verified:false without a network call for a non-MIDNIGHT_CONFIRMED receipt", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const provider = new MidnightProofProvider();
    const result = await provider.verifyReceipt({
      receiptVersion: 1,
      incidentId: "inc-1",
      incidentIdHash: "a".repeat(64),
      evidenceCommitment: "b".repeat(64),
      ruleId: "rule",
      policyId: "policy",
      policyLimitMinutes: 15,
      policySatisfied: true,
      provider: "midnight",
      network: "preprod",
      createdAt: new Date().toISOString(),
      status: "LOCAL_DEMO",
    });

    expect(result.verified).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("verifyReceipt() reports a mismatch (not tampering) when ledger state no longer matches an older receipt", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
          network: "preprod",
          contractAddress: "contract-xyz",
          ledger: {
            incidentIdHash: "c".repeat(64),
            evidenceCommitment: "d".repeat(64),
            policyLimitMinutes: 15,
            policySatisfied: true,
            receiptCount: 2,
          },
        }),
      ),
    );

    const provider = new MidnightProofProvider();
    const result = await provider.verifyReceipt({
      receiptVersion: 1,
      incidentId: "inc-1",
      incidentIdHash: "a".repeat(64),
      evidenceCommitment: "b".repeat(64),
      ruleId: "rule",
      policyId: "policy",
      policyLimitMinutes: 15,
      policySatisfied: true,
      provider: "midnight",
      network: "preprod",
      createdAt: new Date().toISOString(),
      status: "MIDNIGHT_CONFIRMED",
      transactionId: "0xold",
      contractAddress: "contract-xyz",
    });

    expect(result.verified).toBe(false);
    expect(result.message).toMatch(/most recently submitted receipt/);
  });
});
