// Shared bootstrap for the midnight:* CLI scripts. Loads .env.<network> (if present)
// before any @midnight-ntwrk/* module is imported, so MIDNIGHT_NETWORK and the wallet
// secret env vars are available via process.env without a dotenv dependency.
import { existsSync } from "node:fs";

const network = (process.env.MIDNIGHT_NETWORK ?? "local").toLowerCase();
const envFile = `.env.${network}`;

if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
  console.log(`[midnight] loaded ${envFile}`);
} else if (network !== "local") {
  console.warn(`[midnight] ${envFile} not found - relying on shell environment only.`);
}

process.env.MIDNIGHT_NETWORK = network;
