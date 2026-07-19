#!/usr/bin/env node
// Compiles contract/src/proofops.compact with the real Compact compiler.
// See docs/MIDNIGHT_STATUS.md for the verified toolchain versions and the reason this
// script shells out to WSL on native Windows.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hasNativeCompact, hasWsl, isWindows, runShell } from "./wsl-compact.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const COMPILE_CMD = "compact compile contract/src/proofops.compact contract/dist";

console.log("== ProofOps Compact contract build ==");

let result;
if (!isWindows() || hasNativeCompact()) {
  result = runShell(repoRoot, COMPILE_CMD);
} else if (hasWsl()) {
  console.log("Native `compact` CLI not found on Windows (no official Windows binary exists).");
  console.log("Running the real compiler inside WSL (Ubuntu) instead...\n");
  result = runShell(repoRoot, COMPILE_CMD);
} else {
  console.error(
    "Cannot compile the contract: the official Compact toolchain has no native Windows " +
      "binary, and no usable WSL Ubuntu distro was found.\n" +
      "See docs/MIDNIGHT_STATUS.md for the exact installation steps (WSL + compact-installer.sh)."
  );
  process.exit(1);
}

if (!result || result.status !== 0) {
  console.error("\nContract compilation failed. See the compiler output above.");
  process.exit(result?.status ?? 1);
}

console.log("\nContract compiled successfully to contract/dist/");
