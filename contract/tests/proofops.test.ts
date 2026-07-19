import { describe, expect, it } from "vitest";
import { ProofOpsSimulator } from "./proofops-simulator.js";

function bytes32(fill: number): Uint8Array {
  return new Uint8Array(32).fill(fill);
}

describe("ProofOps Compact contract (real compiler + compact-runtime simulator)", () => {
  it("accepts an 8-minute response against a 15-minute containment policy", () => {
    const sim = new ProofOpsSimulator(8n);
    const ledgerState = sim.submitReceipt(bytes32(0xaa), bytes32(0xbb), 15n);

    expect(ledgerState.policySatisfied).toBe(true);
    expect(ledgerState.policyLimitMinutes).toBe(15n);
    expect(ledgerState.receiptCount).toBe(1n);
  });

  it("accepts a response exactly at the 15-minute policy limit", () => {
    const sim = new ProofOpsSimulator(15n);
    const ledgerState = sim.submitReceipt(bytes32(0xaa), bytes32(0xbb), 15n);

    expect(ledgerState.policySatisfied).toBe(true);
  });

  it("rejects a 16-minute response against a 15-minute containment policy", () => {
    const sim = new ProofOpsSimulator(16n);
    expect(() => sim.submitReceipt(bytes32(0xaa), bytes32(0xbb), 15n)).toThrow();
  });

  it("records the evidence commitment and makes it retrievable from the ledger", () => {
    const commitment = bytes32(0xcd);
    const sim = new ProofOpsSimulator(3n);
    const ledgerState = sim.submitReceipt(bytes32(0xaa), commitment, 15n);

    expect(ledgerState.evidenceCommitment).toEqual(commitment);
    expect(sim.getLedger().evidenceCommitment).toEqual(commitment);
  });

  it("exposes only public commitments and the policy result - never the private response time", () => {
    const sim = new ProofOpsSimulator(8n);
    const ledgerState = sim.submitReceipt(bytes32(0xaa), bytes32(0xbb), 15n);

    expect(Object.keys(ledgerState)).toEqual([
      "incidentIdHash",
      "evidenceCommitment",
      "policyLimitMinutes",
      "policySatisfied",
      "receiptCount",
    ]);
    expect(Object.keys(ledgerState)).not.toContain("responseTimeMinutes");
  });

  it("increments and exposes the receipt count via a read-only circuit", () => {
    const sim = new ProofOpsSimulator(5n);
    sim.submitReceipt(bytes32(1), bytes32(2), 15n);
    sim.submitReceipt(bytes32(3), bytes32(4), 15n);

    expect(sim.getReceiptCount()).toBe(2n);
  });
});
