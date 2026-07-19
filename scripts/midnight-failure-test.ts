// Negative-path proof: responseMinutes (16) exceeds policyLimitMinutes (15). The
// contract's assert() must reject proof construction, so no transaction should ever be
// submitted. This script fails loudly (non-zero exit) if a transaction somehow succeeds -
// that would mean the policy assertion was bypassed, which must never happen.
import "./midnight-load-env.ts";
import { getMidnightSession, deployNewContract } from "../server/midnight/session";
import { submitReceipt } from "../server/midnight/receipt";

function bytes32(fill: number): Uint8Array {
  return new Uint8Array(32).fill(fill);
}

async function main() {
  let session = await getMidnightSession();
  if (!session.deployed) {
    session = await deployNewContract();
  }

  console.log(`Network: ${session.network}`);
  console.log(`Contract: ${session.contractAddress}`);
  console.log("Submitting responseMinutes=16 against policyLimitMinutes=15 (should be rejected)...");

  try {
    await submitReceipt(session.providers, session.deployed!, {
      incidentIdHash: bytes32(0xf0),
      evidenceCommitment: bytes32(0xf1),
      policyLimitMinutes: 15n,
      responseMinutes: 16n,
    });
    console.error("FAIL: transaction unexpectedly succeeded. The policy assertion was bypassed.");
    process.exit(1);
  } catch (err) {
    console.log("");
    console.log("PASS: proof construction / transaction submission was rejected, as expected.");
    console.log(`Reason: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Failure test itself errored unexpectedly:", err);
  process.exit(1);
});
