import { deployContract, findDeployedContract, type FoundContract } from "@midnight-ntwrk/midnight-js-contracts";
import type { ContractAddress } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";
import { logger } from "../logger";
import { CompiledProofOpsContract, PRIVATE_STATE_ID, createProofOpsPrivateState, type ProofOpsContract } from "./contract";
import type { ProofOpsProviders } from "./providers";

export type DeployedProofOpsContract = FoundContract<ProofOpsContract>;

export async function deployProofOpsContract(providers: ProofOpsProviders): Promise<DeployedProofOpsContract> {
  logger.info("midnight_contract_deploying");
  const deployed = await deployContract<ProofOpsContract>(providers, {
    compiledContract: CompiledProofOpsContract,
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: createProofOpsPrivateState(0n),
  });
  const contractAddress = deployed.deployTxData.public.contractAddress;
  logger.info("midnight_contract_deployed", { contractAddress });
  return deployed;
}

export async function joinProofOpsContract(
  providers: ProofOpsProviders,
  contractAddress: ContractAddress,
): Promise<DeployedProofOpsContract> {
  logger.info("midnight_contract_joining", { contractAddress });
  providers.privateStateProvider.setContractAddress(contractAddress);
  const existingPrivateState = await providers.privateStateProvider.get(PRIVATE_STATE_ID);
  const deployed = await findDeployedContract<ProofOpsContract>(providers, {
    contractAddress,
    compiledContract: CompiledProofOpsContract,
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: existingPrivateState ?? createProofOpsPrivateState(0n),
  });
  logger.info("midnight_contract_joined", { contractAddress });
  return deployed;
}
