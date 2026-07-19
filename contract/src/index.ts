import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";
import path from "node:path";

export * from "../dist/contract/index.js";
export * from "./witnesses.js";

import { Contract } from "../dist/contract/index.js";
import { witnesses, type ProofOpsPrivateState } from "./witnesses.js";

// Deliberately NOT derived from import.meta.url: when this module is bundled (e.g. by
// esbuild for the production server build), every bundled module shares the URL of the
// final bundle file, not its own original source path - a relative-to-this-file
// computation would silently resolve to the wrong directory at runtime. Every supported
// entry point (tsx scripts, `npm start`, the Docker CMD) runs with the repository root as
// the working directory, so resolving from process.cwd() is robust either way.
export const zkConfigPath = path.resolve(process.cwd(), "contract", "dist");

export type ProofOpsContract = Contract<ProofOpsPrivateState>;

export const CompiledProofOpsContract = CompiledContract.make<ProofOpsContract>(
  "ProofOps",
  Contract<ProofOpsPrivateState>,
).pipe(CompiledContract.withWitnesses(witnesses), CompiledContract.withCompiledFileAssets(zkConfigPath));
