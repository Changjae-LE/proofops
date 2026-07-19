#!/usr/bin/env node
// Prints a quick summary of the current Midnight integration status. This does not
// contact any network - it only inspects local configuration and build artifacts. See
// docs/MIDNIGHT_STATUS.md for the full, honest status writeup.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hasNativeCompact, hasWsl, isWindows } from "./wsl-compact.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readEnvFile() {
  const envPath = path.join(repoRoot, ".env");
  if (!existsSync(envPath)) return {};
  const out = {};
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const match = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (match) out[match[1]] = match[2];
  }
  return out;
}

const env = readEnvFile();
const provider = process.env.VITE_PROOF_PROVIDER ?? env.VITE_PROOF_PROVIDER ?? "local";
const network = process.env.VITE_MIDNIGHT_NETWORK ?? env.VITE_MIDNIGHT_NETWORK ?? "undeployed";
const contractCompiled = existsSync(path.join(repoRoot, "contract", "dist", "contract", "index.js"));
const nativeCompact = hasNativeCompact();
const wslAvailable = isWindows() && hasWsl();

console.log("== ProofOps / Midnight status ==");
console.log(`Active proof provider (VITE_PROOF_PROVIDER): ${provider}`);
console.log(`Configured network (VITE_MIDNIGHT_NETWORK):  ${network}`);
console.log(`Contract compiled (contract/dist present):    ${contractCompiled ? "yes" : "no"}`);
console.log(`Native "compact" CLI on PATH:                 ${nativeCompact ? "yes" : "no"}`);
if (isWindows()) {
  console.log(`WSL (Ubuntu) available as a fallback:         ${wslAvailable ? "yes" : "no"}`);
}
console.log("");
console.log("Full details, verified tool versions, and known blockers: docs/MIDNIGHT_STATUS.md");
