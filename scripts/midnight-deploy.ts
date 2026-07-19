import "./midnight-load-env.ts";
import { getMidnightSession, deployNewContract } from "../server/midnight/session";
import { getConfiguredContractAddress } from "../server/midnight/config";

async function main() {
  const existingAddress = getConfiguredContractAddress();
  if (existingAddress) {
    console.log(`MIDNIGHT_CONTRACT_ADDRESS is already set to ${existingAddress}.`);
    console.log("Joining it instead of deploying a new one...");
    const session = await getMidnightSession();
    console.log(`Joined contract at: ${session.contractAddress}`);
    return;
  }

  console.log("Connecting wallet and deploying a new ProofOps contract...");
  const session = await deployNewContract();
  console.log("");
  console.log("=== Deployment complete ===");
  console.log(`Network: ${session.network}`);
  console.log(`Contract address: ${session.contractAddress}`);
  console.log("");
  console.log("Set this in your .env.<network> to reuse it:");
  console.log(`MIDNIGHT_CONTRACT_ADDRESS=${session.contractAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Deployment failed:", err instanceof Error ? err.stack ?? err.message : err);
    process.exit(1);
  });
