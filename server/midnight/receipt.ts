import type { ContractAddress } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";
import { logger } from "../logger";
import { PRIVATE_STATE_ID, createProofOpsPrivateState, ledger, type Ledger } from "./contract";
import type { DeployedProofOpsContract } from "./deploy";
import type { ProofOpsProviders } from "./providers";

export type SubmitReceiptInput = {
  incidentIdHash: Uint8Array;
  evidenceCommitment: Uint8Array;
  policyLimitMinutes: bigint;
  /** Private witness. Read once by the circuit's assertion, never written to the ledger. */
  responseMinutes: bigint;
};

export type SubmitReceiptResult = {
  txId: string;
  blockHeight: number;
  contractAddress: ContractAddress;
  ledger: Ledger;
};

/**
 * Submits a real submitReceipt transaction. The response-time assertion runs inside the
 * zero-knowledge circuit before any ledger write - if it fails, proof construction throws
 * here and no transaction is ever produced, let alone confirmed.
 */
export async function submitReceipt(
  providers: ProofOpsProviders,
  deployed: DeployedProofOpsContract,
  input: SubmitReceiptInput,
): Promise<SubmitReceiptResult> {
  const contractAddress = deployed.deployTxData.public.contractAddress;

  await providers.privateStateProvider.set(PRIVATE_STATE_ID, createProofOpsPrivateState(input.responseMinutes));

  logger.info("midnight_submit_receipt_start", { contractAddress });
  const txData = await deployed.callTx.submitReceipt(
    input.incidentIdHash,
    input.evidenceCommitment,
    input.policyLimitMinutes,
  );
  logger.info("midnight_submit_receipt_confirmed", {
    contractAddress,
    txHash: txData.public.txHash,
    blockHeight: txData.public.blockHeight,
  });

  const ledgerState = await readLedgerState(providers, contractAddress);
  return {
    txId: txData.public.txHash,
    blockHeight: txData.public.blockHeight,
    contractAddress,
    ledger: ledgerState,
  };
}

/** Independently queries the indexer for the current public ledger state of a contract. */
export async function readLedgerState(providers: ProofOpsProviders, contractAddress: ContractAddress): Promise<Ledger> {
  const state = await providers.publicDataProvider.queryContractState(contractAddress);
  if (!state) {
    throw new Error(`No contract state found at address ${contractAddress}`);
  }
  return ledger(state.data);
}
