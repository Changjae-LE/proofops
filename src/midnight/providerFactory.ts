import { LocalDemoProofProvider } from "./LocalDemoProofProvider";
import { MidnightProofProvider } from "./MidnightProofProvider";
import type { ProofProvider } from "./ProofProvider";

let cachedProvider: ProofProvider | null = null;

/**
 * Selects the active ProofProvider based on VITE_PROOF_PROVIDER. Defaults to "local" so
 * the application always starts and is always demoable, even with no environment
 * configuration at all.
 */
export function createProofProvider(): ProofProvider {
  const selected = (import.meta.env.VITE_PROOF_PROVIDER ?? "local").toLowerCase();
  if (selected === "midnight") {
    return new MidnightProofProvider();
  }
  return new LocalDemoProofProvider();
}

export function getProofProvider(): ProofProvider {
  if (!cachedProvider) {
    cachedProvider = createProofProvider();
  }
  return cachedProvider;
}
