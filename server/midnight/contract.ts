import {
  CompiledProofOpsContract,
  zkConfigPath,
  ledger,
  type Ledger,
  type ProofOpsContract,
} from "../../contract/src/index";
import { createProofOpsPrivateState } from "../../contract/src/witnesses";

export type ProofOpsCircuits = Exclude<keyof ProofOpsContract["impureCircuits"], number | symbol>;

export const PRIVATE_STATE_ID = "proofOpsPrivateState";

export { CompiledProofOpsContract, zkConfigPath, createProofOpsPrivateState, ledger, type Ledger, type ProofOpsContract };
