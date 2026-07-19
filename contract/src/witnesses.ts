import type { WitnessContext } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";
import type { Ledger } from "../dist/contract/index.js";

/**
 * Private state for the ProofOps contract: the actual response time in minutes,
 * computed off-chain from the incident timeline. Never written to the ledger; read
 * here only as a witness input to the submitReceipt circuit's assertion.
 */
export type ProofOpsPrivateState = {
  readonly responseTimeMinutes: bigint;
};

export const createProofOpsPrivateState = (responseTimeMinutes: bigint): ProofOpsPrivateState => ({
  responseTimeMinutes,
});

export const witnesses = {
  responseTimeMinutes({
    privateState,
  }: WitnessContext<Ledger, ProofOpsPrivateState>): [ProofOpsPrivateState, bigint] {
    return [privateState, privateState.responseTimeMinutes];
  },
};
