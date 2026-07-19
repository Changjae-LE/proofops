// One-shot helper: generates a fresh random-seed Midnight wallet for the Preprod
// network and prints its address so the operator can fund it via the Preprod
// faucet. Does not start wallet sync or touch the network - key generation is
// local and offline. Run with: npx tsx scripts/midnight-generate-wallet.ts
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { LedgerParameters, ZswapSecretKeys } from "@midnight-ntwrk/midnight-js-protocol/ledger";
import { FluentWalletBuilder, type DustWalletOptions, type EnvironmentConfiguration } from "@midnight-ntwrk/testkit-js";

const PREPROD_ENV: EnvironmentConfiguration = {
  walletNetworkId: "preprod",
  networkId: "preprod",
  indexer: "https://indexer.preprod.midnight.network/api/v4/graphql",
  indexerWS: "wss://indexer.preprod.midnight.network/api/v4/graphql/ws",
  node: "https://rpc.preprod.midnight.network",
  nodeWS: "wss://rpc.preprod.midnight.network",
  faucet: "https://midnight-tmnight-preprod.nethermind.dev/",
  proofServer: "http://127.0.0.1:6300",
};

async function main() {
  setNetworkId(PREPROD_ENV.networkId);

  const dustOptions: DustWalletOptions = {
    ledgerParams: LedgerParameters.initialParameters(),
    additionalFeeOverhead: 1_000n,
    feeBlocksMargin: 5,
  };

  const buildResult = await FluentWalletBuilder.forEnvironment(PREPROD_ENV)
    .withDustOptions(dustOptions)
    .withRandomSeed()
    .buildWithoutStarting();

  const { seeds } = buildResult as unknown as {
    seeds: { masterSeed: string; shielded: Uint8Array; dust: Uint8Array };
  };

  const shieldedKeys = ZswapSecretKeys.fromSeed(seeds.shielded);

  console.log("=== ProofOps Preprod deployer wallet (generated locally, not yet funded) ===");
  console.log(`Master seed (hex, KEEP SECRET - store only in .env.preprod, never commit):`);
  console.log(seeds.masterSeed);
  console.log("");
  console.log(`Coin public key / address to fund via the faucet:`);
  console.log(shieldedKeys.coinPublicKey);
}

main().catch((err) => {
  console.error("Wallet generation failed:", err);
  process.exitCode = 1;
});
