// Real-network integration tests. Requires a reachable Midnight network (local devnet via
// `npm run midnight:env:up`, or a funded Preview/Preprod wallet via .env.<network>) and a
// running proof server. Never run by `npm test` - only by `npm run midnight:test:integration`.
// Deliberately mirrors the official midnightntwrk/example-hello-world test pattern
// (deploy, then interact, then independently re-query the ledger).
import { afterAll, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { resetMidnightSessionForTests, getMidnightSession, deployNewContract } from "../../server/midnight/session";
import { submitReceipt, readLedgerState } from "../../server/midnight/receipt";

// WebSocket global assignment for the GraphQL subscription client used by the indexer
// public data provider under Node.
globalThis.WebSocket ??= WebSocket as unknown as typeof globalThis.WebSocket;

function bytes32(fill: number): Uint8Array {
  return new Uint8Array(32).fill(fill);
}

describe(`ProofOps Midnight contract on '${process.env.MIDNIGHT_NETWORK ?? "local"}' (real network)`, () => {
  afterAll(async () => {
    const session = await getMidnightSession();
    await session.wallet.stop().catch(() => undefined);
    resetMidnightSessionForTests();
  });

  it("deploys a real contract and the deployed address is well-formed", async () => {
    const session = await deployNewContract();
    expect(session.contractAddress).toBeDefined();
    expect(session.contractAddress!.length).toBeGreaterThan(0);
  });

  it("submits a real submitReceipt transaction and confirms it on-chain", async () => {
    const session = await getMidnightSession();
    const result = await submitReceipt(session.providers, session.deployed!, {
      incidentIdHash: bytes32(0xaa),
      evidenceCommitment: bytes32(0xbb),
      policyLimitMinutes: 15n,
      responseMinutes: 8n,
    });

    expect(result.txId.length).toBeGreaterThan(0);
    expect(result.ledger.policySatisfied).toBe(true);
    expect(result.ledger.policyLimitMinutes).toBe(15n);
  });

  it("independently re-queries the indexer and the private response time is absent from public state", async () => {
    const session = await getMidnightSession();
    const ledgerState = await readLedgerState(session.providers, session.contractAddress!);

    expect(Object.keys(ledgerState)).toEqual([
      "incidentIdHash",
      "evidenceCommitment",
      "policyLimitMinutes",
      "policySatisfied",
      "receiptCount",
    ]);
    expect(Object.keys(ledgerState)).not.toContain("responseTimeMinutes");
  });

  it("rejects a response time that exceeds the policy limit - no transaction is created", async () => {
    const session = await getMidnightSession();
    await expect(
      submitReceipt(session.providers, session.deployed!, {
        incidentIdHash: bytes32(0xcc),
        evidenceCommitment: bytes32(0xdd),
        policyLimitMinutes: 15n,
        responseMinutes: 16n,
      }),
    ).rejects.toThrow();
  });
}, 20 * 60_000);
