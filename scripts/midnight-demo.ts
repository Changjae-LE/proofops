// End-to-end real-network demo: loads the bundled sample incident, runs it through the
// same client-side analysis/hashing pipeline the browser UI uses (src/lib/analyzer.ts,
// src/lib/receipt.ts), then submits a real submitReceipt transaction to the configured
// Midnight network and independently re-reads the ledger to verify what was recorded.
import "./midnight-load-env.ts";
import { readFileSync } from "node:fs";
import { analyzeIncident } from "../src/lib/analyzer";
import { buildReceiptCore } from "../src/lib/receipt";
import type { IncidentDocument } from "../src/types/incident";
import { getMidnightSession, deployNewContract } from "../server/midnight/session";
import { submitReceipt, readLedgerState } from "../server/midnight/receipt";
import { getConfiguredContractAddress } from "../server/midnight/config";

function hexToBytes(hex: string): Uint8Array {
  return new Uint8Array(Buffer.from(hex, "hex"));
}

async function main() {
  const incident: IncidentDocument = JSON.parse(
    readFileSync("public/samples/imds-role-use-incident.json", "utf-8"),
  );
  const analysis = analyzeIncident(incident);
  if (analysis.status !== "DETECTED") {
    throw new Error(`Sample incident did not analyze as expected: ${analysis.reason}`);
  }

  const core = await buildReceiptCore(analysis, incident as never);
  console.log(`Incident: ${core.incidentId}`);
  console.log(`Response time (private witness): ${analysis.policy.responseMinutes} minutes`);
  console.log(`Policy limit (public): ${analysis.policy.limitMinutes} minutes`);
  console.log(`incidentIdHash: ${core.incidentIdHash}`);
  console.log(`evidenceCommitment: ${core.evidenceCommitment}`);
  console.log("");

  let session = await getMidnightSession();
  if (!session.deployed) {
    console.log("No contract configured - deploying a new one...");
    session = await deployNewContract();
  }
  console.log(`Network: ${session.network}`);
  console.log(`Contract address: ${session.contractAddress}`);
  console.log("");

  console.log("Submitting real submitReceipt transaction...");
  const result = await submitReceipt(session.providers, session.deployed!, {
    incidentIdHash: hexToBytes(core.incidentIdHash),
    evidenceCommitment: hexToBytes(core.evidenceCommitment),
    policyLimitMinutes: BigInt(analysis.policy.limitMinutes),
    responseMinutes: BigInt(Math.round(analysis.policy.responseMinutes)),
  });

  console.log("");
  console.log("=== MIDNIGHT_CONFIRMED ===");
  console.log(`Transaction ID: ${result.txId}`);
  console.log(`Block height: ${result.blockHeight}`);
  console.log("");

  console.log("Independently re-querying the indexer for the ledger state...");
  const ledgerState = await readLedgerState(session.providers, session.contractAddress!);
  console.log("Ledger state:", {
    incidentIdHash: Buffer.from(ledgerState.incidentIdHash).toString("hex"),
    evidenceCommitment: Buffer.from(ledgerState.evidenceCommitment).toString("hex"),
    policyLimitMinutes: ledgerState.policyLimitMinutes.toString(),
    policySatisfied: ledgerState.policySatisfied,
    receiptCount: ledgerState.receiptCount.toString(),
  });
  console.log("");
  console.log(
    `Private response time (${analysis.policy.responseMinutes} min) present on ledger? ` +
      `${Object.keys(ledgerState).includes("responseTimeMinutes") ? "YES (BUG)" : "no - confirmed absent"}`,
  );

  if (!getConfiguredContractAddress()) {
    console.log("");
    console.log("Tip: set this to reuse the same contract next time:");
    console.log(`MIDNIGHT_CONTRACT_ADDRESS=${session.contractAddress}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Demo failed:", err instanceof Error ? err.stack ?? err.message : err);
    process.exit(1);
  });
