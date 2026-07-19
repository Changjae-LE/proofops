import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";

// server/midnight/session and server/midnight/receipt both transitively import the real
// @midnight-ntwrk/* SDK (testkit-js, midnight-js-contracts, etc). These routes tests must
// stay offline and fast, so the network/wallet layer is mocked here; only HTTP-facing
// behavior of the router itself (status codes, error propagation, payload shape) is
// under test - the real SDK integration is covered separately by
// tests/integration/midnight-network.test.ts against a live network.
const sessionMock = vi.hoisted(() => ({
  getMidnightSession: vi.fn(),
  getSessionState: vi.fn(),
  deployNewContract: vi.fn(),
}));
const receiptMock = vi.hoisted(() => ({
  submitReceipt: vi.fn(),
  readLedgerState: vi.fn(),
}));

vi.mock("../server/midnight/session", () => sessionMock);
vi.mock("../server/midnight/receipt", () => receiptMock);

import { createMidnightRouter } from "../server/midnightRoutes";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/midnight", createMidnightRouter());
  return app;
}

const VALID_HASH_A = "aa".repeat(32);
const VALID_HASH_B = "bb".repeat(32);

describe("Midnight API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.MIDNIGHT_NETWORK;
    delete process.env.MIDNIGHT_CONTRACT_ADDRESS;
  });
  afterEach(() => {
    delete process.env.MIDNIGHT_NETWORK;
    delete process.env.MIDNIGHT_CONTRACT_ADDRESS;
  });

  it("GET /status reports configured:true using MIDNIGHT_NETWORK default (local)", async () => {
    sessionMock.getSessionState.mockReturnValue({ phase: "idle" });
    const res = await request(buildApp()).get("/api/midnight/status");
    expect(res.status).toBe(200);
    expect(res.body.configured).toBe(true);
    expect(res.body.network).toBe("local");
    expect(res.body.phase).toBe("idle");
  });

  it("POST /receipt never returns MIDNIGHT_CONFIRMED or a transaction id when submission fails", async () => {
    sessionMock.getMidnightSession.mockResolvedValue({ deployed: { fake: true }, network: "local" });
    receiptMock.submitReceipt.mockRejectedValue(
      new Error("response time exceeds the policy containment limit"),
    );

    const res = await request(buildApp()).post("/api/midnight/receipt").send({
      incidentIdHash: VALID_HASH_A,
      evidenceCommitment: VALID_HASH_B,
      policyLimitMinutes: 15,
      responseMinutes: 16,
    });

    expect(res.status).toBe(502);
    expect(res.body.status).toBeUndefined();
    expect(res.body.txId).toBeUndefined();
    expect(res.body.error).toMatch(/policy containment limit/);
  });

  it("POST /receipt returns MIDNIGHT_CONFIRMED only after the mocked network call actually resolves", async () => {
    sessionMock.getMidnightSession.mockResolvedValue({ deployed: { fake: true }, network: "preprod" });
    receiptMock.submitReceipt.mockResolvedValue({
      txId: "0xdeadbeef",
      blockHeight: 42,
      contractAddress: "contract-addr-123",
      ledger: {
        incidentIdHash: Buffer.from(VALID_HASH_A, "hex"),
        evidenceCommitment: Buffer.from(VALID_HASH_B, "hex"),
        policyLimitMinutes: 15n,
        policySatisfied: true,
        receiptCount: 1n,
      },
    });

    const res = await request(buildApp()).post("/api/midnight/receipt").send({
      incidentIdHash: VALID_HASH_A,
      evidenceCommitment: VALID_HASH_B,
      policyLimitMinutes: 15,
      responseMinutes: 8,
    });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("MIDNIGHT_CONFIRMED");
    expect(res.body.txId).toBe("0xdeadbeef");
    expect(res.body.contractAddress).toBe("contract-addr-123");
    // The serialized public ledger payload must never contain a private response-time field.
    expect(Object.keys(res.body.ledger)).toEqual([
      "incidentIdHash",
      "evidenceCommitment",
      "policyLimitMinutes",
      "policySatisfied",
      "receiptCount",
    ]);
    expect(res.body.ledger).not.toHaveProperty("responseTimeMinutes");
    expect(res.body.ledger).not.toHaveProperty("responseMinutes");
  });

  it("POST /receipt rejects malformed hex fields before ever calling the network layer", async () => {
    sessionMock.getMidnightSession.mockResolvedValue({ deployed: { fake: true } });

    const res = await request(buildApp()).post("/api/midnight/receipt").send({
      incidentIdHash: "not-valid-hex",
      evidenceCommitment: VALID_HASH_B,
      policyLimitMinutes: 15,
      responseMinutes: 8,
    });

    expect(res.status).toBe(400);
    expect(receiptMock.submitReceipt).not.toHaveBeenCalled();
  });

  it("POST /receipt returns 409 (not a fabricated success) when no contract is deployed yet", async () => {
    sessionMock.getMidnightSession.mockResolvedValue({ deployed: undefined });

    const res = await request(buildApp()).post("/api/midnight/receipt").send({
      incidentIdHash: VALID_HASH_A,
      evidenceCommitment: VALID_HASH_B,
      policyLimitMinutes: 15,
      responseMinutes: 8,
    });

    expect(res.status).toBe(409);
    expect(res.body.status).toBeUndefined();
  });

  it("GET /ledger propagates a real query failure instead of returning fabricated state", async () => {
    sessionMock.getMidnightSession.mockResolvedValue({ contractAddress: "addr-1", network: "local" });
    receiptMock.readLedgerState.mockRejectedValue(new Error("indexer unreachable"));

    const res = await request(buildApp()).get("/api/midnight/ledger");
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/indexer unreachable/);
  });

  it("POST /deploy propagates errors instead of returning a fabricated contract address", async () => {
    sessionMock.deployNewContract.mockRejectedValue(new Error("wallet has no spendable DUST"));
    const res = await request(buildApp()).post("/api/midnight/deploy");
    expect(res.status).toBe(502);
    expect(res.body.contractAddress).toBeUndefined();
    expect(res.body.error).toMatch(/DUST/);
  });
});
