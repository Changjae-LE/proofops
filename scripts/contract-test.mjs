#!/usr/bin/env node
// Runs the real compact-runtime simulator tests in contract/tests against the compiled
// contract. Requires contract/dist to exist (run `npm run contract:build` first) and
// contract/node_modules to be installed for the platform actually running the tests.
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hasNativeCompact, hasWsl, isWindows, runShell } from "./wsl-compact.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contractDist = path.join(repoRoot, "contract", "dist", "contract", "index.js");

console.log("== ProofOps Compact contract tests ==");

if (!existsSync(contractDist)) {
  console.error(
    'contract/dist is missing or incomplete. Run "npm run contract:build" first ' +
      "(see docs/MIDNIGHT_STATUS.md for platform requirements)."
  );
  process.exit(1);
}

const TEST_CMD = "npm --prefix contract install && npm --prefix contract test";

let result;
if (!isWindows() || hasNativeCompact()) {
  result = runShell(repoRoot, TEST_CMD);
} else if (hasWsl()) {
  console.log("Running contract tests inside WSL (Ubuntu) - required native modules were");
  console.log("installed for Linux during the last `npm run contract:build`.\n");
  result = runShell(repoRoot, TEST_CMD);
} else {
  console.error(
    "Cannot run contract tests: no native Compact toolchain and no usable WSL Ubuntu distro."
  );
  process.exit(1);
}

if (!result || result.status !== 0) {
  console.error("\nContract tests failed. See output above.");
  process.exit(result?.status ?? 1);
}

console.log("\nAll contract simulator tests passed.");
