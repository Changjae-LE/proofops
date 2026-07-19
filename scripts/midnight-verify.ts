// Independently re-queries the indexer for the current ledger state of the configured
// contract and prints it, without submitting anything. Used to verify a prior
// deployment/receipt from a fresh process (no cached in-memory state).
import "./midnight-load-env.ts";
import { getMidnightSession } from "../server/midnight/session";
import { readLedgerState } from "../server/midnight/receipt";

async function main() {
  const session = await getMidnightSession();
  if (!session.contractAddress) {
    throw new Error("No contract configured. Set MIDNIGHT_CONTRACT_ADDRESS or run npm run midnight:deploy first.");
  }

  const ledgerState = await readLedgerState(session.providers, session.contractAddress);
  console.log(`Network: ${session.network}`);
  console.log(`Contract address: ${session.contractAddress}`);
  console.log("Ledger state (public only):", {
    incidentIdHash: Buffer.from(ledgerState.incidentIdHash).toString("hex"),
    evidenceCommitment: Buffer.from(ledgerState.evidenceCommitment).toString("hex"),
    policyLimitMinutes: ledgerState.policyLimitMinutes.toString(),
    policySatisfied: ledgerState.policySatisfied,
    receiptCount: ledgerState.receiptCount.toString(),
  });
  console.log(
    `Ledger field set: [${Object.keys(ledgerState).join(", ")}] - no responseTimeMinutes field exists.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Verification failed:", err instanceof Error ? err.stack ?? err.message : err);
    process.exit(1);
  });
